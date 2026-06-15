import { NextRequest, NextResponse } from 'next/server'
import { createCreditCardPayment, createCustomer, createPixPayment, getPixQrCode, onlyDigits } from '@/lib/asaas'
import { fulfillPaidOrder } from '@/lib/order-fulfillment'
import { getPlatformAccess } from '@/lib/platform-access'
import { createAdminClient } from '@/utils/supabase/admin'
import { isValidCardExpiry, isValidCardNumber, isValidCpfCnpj, isValidEmail, isValidPhone, isValidCvv, isValidPostalCode } from '@/lib/validation'
import { hashIdentifier } from '@/lib/hash'

type PlanProduct = {
  id: string
  name: string
  owner_id: string
}

type PlanRow = {
  id: string
  name: string
  price: number
  product: PlanProduct
}

function getBody<T extends Record<string, unknown>>(req: NextRequest) {
  return req.json() as Promise<T>
}

const PAID_STATUSES = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'])

function today() {
  return new Date().toISOString().slice(0, 10)
}

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return req.headers.get('x-real-ip') || '127.0.0.1'
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split('@')
  return localPart && domain ? `${localPart.charAt(0)}***@${domain}` : '***'
}

function firstName(name: string) {
  return name.split(/\s+/)[0] || 'Cliente'
}

function sameWallet(left?: string | null, right?: string | null) {
  return Boolean(left && right && left.trim() === right.trim())
}

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get('content-length') || 0)
  if (contentLength > 16_384) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 413 })
  }

  const supabase = createAdminClient()
  let step = 'init'

  try {
    const clientIp = getClientIp(req)
    const { data: withinRateLimit, error: rateLimitError } = await supabase.rpc('consume_rate_limit', {
      requested_bucket: 'checkout',
      requested_identifier_hash: await hashIdentifier(clientIp),
      max_requests: 12,
      window_seconds: 60,
    })

    if (rateLimitError) {
      console.error('[Asaas Checkout] Rate limiter unavailable.')
      return NextResponse.json({ error: 'Checkout temporariamente indisponivel.' }, { status: 503 })
    }

    if (!withinRateLimit) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' }, { status: 429 })
    }

    step = 'validate'

    const body = await getBody<Record<string, unknown>>(req)
    const planId = String(body.plan_id || '')
    const customerName = String(body.customer_name || '').trim()
    const customerEmail = String(body.customer_email || '').trim()
    const customerDocument = onlyDigits(String(body.customer_document || ''))
    const customerPhone = onlyDigits(String(body.customer_phone || ''))
    const addOrderBump = Boolean(body.add_order_bump)
    const billingType = String(body.billing_type || 'CREDIT_CARD')

    if (billingType !== 'PIX' && billingType !== 'CREDIT_CARD') {
      return NextResponse.json({ error: 'Forma de pagamento invalida.' }, { status: 400 })
    }

    if (!planId || !customerName || !customerEmail || !customerDocument || !customerPhone) {
      return NextResponse.json({ error: 'Preencha nome, e-mail, CPF/CNPJ e telefone.' }, { status: 400 })
    }

    if (!isValidEmail(customerEmail) || !isValidCpfCnpj(customerDocument) || !isValidPhone(customerPhone)) {
      return NextResponse.json({ error: 'Informe um e-mail, CPF/CNPJ e telefone válidos.' }, { status: 400 })
    }

    const cardNumber = onlyDigits(String((body.card as Record<string, unknown> | undefined)?.number || ''))
    const cardCcv = onlyDigits(String((body.card as Record<string, unknown> | undefined)?.ccv || ''))
    const cardHolderName = String((body.card as Record<string, unknown> | undefined)?.holderName || '').trim()
    const cardExpiryMonth = String((body.card as Record<string, unknown> | undefined)?.expiryMonth || '').padStart(2, '0')
    const cardExpiryYear = String((body.card as Record<string, unknown> | undefined)?.expiryYear || '')
    const holderPostalCode = onlyDigits(String((body.holder as Record<string, unknown> | undefined)?.postalCode || ''))
    const holderAddressNumber = String((body.holder as Record<string, unknown> | undefined)?.addressNumber || '').trim()

    if (billingType === 'CREDIT_CARD') {
      if (!isValidCardNumber(cardNumber) || !isValidCvv(cardCcv) || !isValidCardExpiry(cardExpiryMonth, cardExpiryYear) || !cardHolderName) {
        return NextResponse.json({ error: 'Confira os dados do cartão.' }, { status: 400 })
      }

      if (!isValidPostalCode(holderPostalCode) || !holderAddressNumber) {
        return NextResponse.json({ error: 'Informe o CEP e o número do endereço do titular do cartão.' }, { status: 400 })
      }
    }

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select(`
        *,
        product:products(
          id, name, owner_id
        )
      `)
      .eq('id', planId)
      .single<PlanRow>()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plano nao encontrado.' }, { status: 404 })
    }

    const product = plan.product
    const producerAccess = await getPlatformAccess(product.owner_id)
    if (!producerAccess.allowed) {
      return NextResponse.json({ error: 'Checkout indisponivel. Produtor precisa regularizar a assinatura Flowyn Pro.' }, { status: 402 })
    }

    const { data: producerAccount } = await supabase
      .from('payment_accounts')
      .select('wallet_id')
      .eq('user_id', product.owner_id)
      .eq('provider', 'asaas')
      .single()

    if (!producerAccount?.wallet_id) {
      return NextResponse.json({ error: 'Produtor ainda nao conectou a carteira Asaas.' }, { status: 409 })
    }

    let orderBumpAmount = 0
    if (addOrderBump) {
      const { data: bumps } = await supabase
        .from('product_order_bumps')
        .select('price')
        .eq('product_id', product.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1)

      if (bumps && bumps.length > 0) {
        orderBumpAmount = Number(bumps[0].price)
      }
    }
    const totalAmount = Number((Number(plan.price) + orderBumpAmount).toFixed(2))

    if (!Number.isFinite(Number(plan.price)) || Number(plan.price) <= 0 || !Number.isFinite(totalAmount) || totalAmount <= 0) {
      return NextResponse.json({ error: 'Valor do produto invalido.' }, { status: 400 })
    }

    step = 'create_asaas_customer'

    const customerPayload = {
      name: customerName,
      cpfCnpj: customerDocument,
      email: customerEmail,
      mobilePhone: customerPhone,
      externalReference: customerEmail,
      notificationDisabled: true,
    }

    const asaasApiKey = process.env.ASAAS_API_KEY
    if (!asaasApiKey) {
      console.error('[Asaas Checkout] ASAAS_API_KEY is not configured.')
      return NextResponse.json({ error: 'Pagamento indisponível no momento.' }, { status: 503 })
    }

    const asaasCustomer = await createCustomer(customerPayload, asaasApiKey)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        product_id: product.id,
        plan_id: plan.id,
        affiliate_id: null,
        customer_name: firstName(customerName),
        customer_email: maskEmail(customerEmail),
        amount: totalAmount,
        commission_rate: 0,
        commission_amount: 0,
        producer_amount: totalAmount,
        status: 'pending',
        asaas_customer_id: asaasCustomer.id,
        payment_provider: 'asaas',
        tracking_id: null,
        includes_order_bump: orderBumpAmount > 0,
        order_bump_amount: orderBumpAmount,
      })
      .select('id')
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Erro ao registrar pedido.' }, { status: 500 })
    }

    const { error: privateCustomerError } = await supabase
      .from('order_customer_private')
      .insert({
        order_id: order.id,
        customer_name: customerName,
        customer_email: customerEmail,
        document_number: customerDocument,
        phone: customerPhone,
      })

    if (privateCustomerError) {
      console.error('[Asaas Checkout] Could not persist private customer data.')
      await supabase.from('orders').delete().eq('id', order.id)
      return NextResponse.json({ error: 'Erro ao registrar os dados do pedido.' }, { status: 500 })
    }

    const mainWalletId = process.env.ASAAS_MAIN_WALLET_ID?.trim()
    const producerUsesMainWallet = !mainWalletId || sameWallet(producerAccount.wallet_id, mainWalletId)
    const split = producerUsesMainWallet
      ? []
      : [{ walletId: producerAccount.wallet_id, percentualValue: 100 }]

    step = 'pix_payment'

    if (billingType === 'PIX') {
      const payment = await createPixPayment({
        customer: asaasCustomer.id,
        billingType: 'PIX',
        value: totalAmount,
        dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        description: `${product.name} - ${plan.name}`,
        externalReference: order.id,
        remoteIp: clientIp,
        ...(split.length > 0 ? { split } : {}),
      }, process.env.ASAAS_API_KEY!)

      let pixQrCode = payment.pixQrCode ?? null
      let pixKey = payment.pixKey ?? null

      if (!pixQrCode || !pixKey) {
        step = 'pix_qrcode_fallback'
        try {
          const pixData = await getPixQrCode(payment.id, process.env.ASAAS_API_KEY!)
          pixQrCode = pixData.encodedImage
          pixKey = pixData.payload
        } catch (pixErr) {
          console.error('[Asaas Checkout] PIX QR fallback also failed:', pixErr)
        }
      }

      await supabase
        .from('orders')
        .update({
          asaas_payment_id: payment.id,
          asaas_status: payment.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      return NextResponse.json({
        success: false,
        order_id: order.id,
        payment_id: payment.id,
        status: payment.status,
        pixQrCode: pixQrCode,
        pixKey: pixKey,
        invoice_url: payment.invoiceUrl ?? null,
      })
    }

    step = 'credit_card_payment'

    const payment = await createCreditCardPayment({
      customer: asaasCustomer.id,
      billingType: 'CREDIT_CARD',
      value: totalAmount,
      dueDate: today(),
      description: `${product.name} - ${plan.name}`,
      externalReference: order.id,
      ...(split.length > 0 ? { split } : {}),
      creditCard: {
        holderName: cardHolderName,
        number: cardNumber,
        expiryMonth: cardExpiryMonth,
        expiryYear: cardExpiryYear,
        ccv: cardCcv,
      },
      creditCardHolderInfo: {
        name: String((body.holder as Record<string, unknown> | undefined)?.name || customerName).trim(),
        email: String((body.holder as Record<string, unknown> | undefined)?.email || customerEmail).trim(),
        cpfCnpj: onlyDigits(String((body.holder as Record<string, unknown> | undefined)?.cpfCnpj || customerDocument)),
        postalCode: holderPostalCode,
        addressNumber: holderAddressNumber,
        addressComplement: String((body.holder as Record<string, unknown> | undefined)?.addressComplement || '').trim() || null,
        mobilePhone: onlyDigits(String((body.holder as Record<string, unknown> | undefined)?.mobilePhone || customerPhone)),
      },
      remoteIp: clientIp,
    }, process.env.ASAAS_API_KEY!)

    await supabase
      .from('orders')
      .update({
        asaas_payment_id: payment.id,
        asaas_status: payment.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    if (PAID_STATUSES.has(payment.status)) {
      await fulfillPaidOrder(supabase, order.id, payment.status)
    }

    return NextResponse.json({
      success: PAID_STATUSES.has(payment.status),
      order_id: order.id,
      payment_id: payment.id,
      status: payment.status,
      invoice_url: payment.invoiceUrl,
    }, { headers: { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const errName = err instanceof Error ? err.name : typeof err
    console.error('[Asaas Checkout] Error:', {
      step,
      message,
      errName,
      hasAsaasKey: Boolean(process.env.ASAAS_API_KEY),
      asaasUrl: process.env.ASAAS_API_URL || '(default sandbox)',
      hasMainWallet: Boolean(process.env.ASAAS_MAIN_WALLET_ID),
    })

    if (message.includes('ASAAS_API_KEY') || message.includes('api_key') || message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('invalid_api') || message.toLowerCase().includes('invalid api')) {
      return NextResponse.json({ error: 'Pagamento indisponível no momento. Tente novamente mais tarde.' }, { status: 503 })
    }

    if (message.includes('ENOTFOUND') || message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT') || message.includes('fetch failed') || message.includes('econnreset')) {
      return NextResponse.json({ error: 'Serviço de pagamento temporariamente indisponível. Tente novamente em instantes.' }, { status: 503 })
    }

    if (message.includes('subaccount') || message.includes('split') || message.includes('wallet_id')) {
      return NextResponse.json({ error: 'Configuração de pagamento do produtor inválida. Ele precisa revisar a conta Asaas.' }, { status: 502 })
    }

    if (step === 'credit_card_payment') {
      return NextResponse.json({ error: `Pagamento não aprovado: ${message}` }, { status: 422 })
    }

    if (step === 'pix_payment' || step === 'pix_qrcode_fallback') {
      return NextResponse.json({ error: `Não foi possível gerar o Pix: ${message}` }, { status: 502 })
    }

    return NextResponse.json({
      error: 'Erro ao processar pagamento. Entre em contato com o suporte informando o horário exato.',
      _step: step,
    }, { status: 500 })
  }
}
