import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import {
  createCreditCardPayment,
  createCustomer,
  onlyDigits,
} from '@/lib/asaas'
import { fulfillPaidOrder } from '@/lib/order-fulfillment'
import { getPlatformAccess } from '@/lib/platform-access'
import { createAdminClient } from '@/utils/supabase/admin'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return req.headers.get('x-real-ip') || '127.0.0.1'
}

function hashIdentifier(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split('@')
  return localPart && domain ? `${localPart.charAt(0)}***@${domain}` : '***'
}

function firstName(name: string) {
  return name.split(/\s+/)[0] || 'Cliente'
}

const PAID_STATUSES = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'])

function sameWallet(left?: string | null, right?: string | null) {
  return Boolean(left && right && left.trim() === right.trim())
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()

  try {
    const clientIp = getClientIp(req)
    const { data: withinRateLimit, error: rateLimitError } = await supabase.rpc('consume_rate_limit', {
      requested_bucket: 'checkout',
      requested_identifier_hash: hashIdentifier(clientIp),
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

    const body = await req.json()
    const planId = String(body.plan_id || '')
    const customerName = String(body.customer_name || '').trim()
    const customerEmail = String(body.customer_email || '').trim()
    const customerDocument = onlyDigits(body.customer_document)
    const customerPhone = onlyDigits(body.customer_phone)
    const trackingId = body.tracking_id ? String(body.tracking_id) : null
    const addOrderBump = Boolean(body.add_order_bump)

    if (!planId || !customerName || !customerEmail || !customerDocument || !customerPhone) {
      return NextResponse.json({ error: 'Preencha nome, e-mail, CPF/CNPJ e telefone.' }, { status: 400 })
    }

    if (!customerEmail.includes('@') || ![11, 14].includes(customerDocument.length)) {
      return NextResponse.json({ error: 'Informe um e-mail e CPF/CNPJ validos.' }, { status: 400 })
    }

    const cardNumber = onlyDigits(body.card?.number)
    const cardCcv = onlyDigits(body.card?.ccv)
    if (cardNumber.length < 13 || cardNumber.length > 19 || cardCcv.length < 3 || cardCcv.length > 4) {
      return NextResponse.json({ error: 'Confira os dados do cartao.' }, { status: 400 })
    }

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select(`
        *,
        product:products(
          id, name, commission_rate, owner_id, is_flowyn_saas,
          order_bump_title, order_bump_description, order_bump_price, order_bump_discount_percent
        )
      `)
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plano não encontrado.' }, { status: 404 })
    }

    const product = plan.product as any
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
      return NextResponse.json({ error: 'Produtor ainda não conectou a carteira Asaas.' }, { status: 409 })
    }

    let affiliateId: string | null = null
    let affiliateWalletId: string | null = null

    if (trackingId) {
      const { data: affiliation } = await supabase
        .from('affiliations')
        .select('affiliate_id, status')
        .eq('tracking_id', trackingId)
        .eq('product_id', product.id)
        .single()

      if (affiliation?.status === 'active') {
        affiliateId = affiliation.affiliate_id
        const { data: affiliateAccount } = await supabase
          .from('payment_accounts')
          .select('wallet_id')
          .eq('user_id', affiliateId)
          .eq('provider', 'asaas')
          .single()
        affiliateWalletId = affiliateAccount?.wallet_id || null
      }
    }

    const commissionRate = product.is_flowyn_saas ? 75 : Number(product.commission_rate || 0)
    const baseAmount = Number(plan.price)
    const rawBumpAmount = addOrderBump && product.order_bump_price ? Number(product.order_bump_price) : 0
    const discount = rawBumpAmount > 0 ? Number(product.order_bump_discount_percent || 0) : 0
    const orderBumpAmount = rawBumpAmount > 0 && discount > 0 ? rawBumpAmount * (1 - discount / 100) : rawBumpAmount
    const totalAmount = Number((baseAmount + orderBumpAmount).toFixed(2))
    const commissionAmount = affiliateId ? Number(((totalAmount * commissionRate) / 100).toFixed(2)) : 0

    if (!Number.isFinite(baseAmount) || baseAmount <= 0 || !Number.isFinite(totalAmount) || totalAmount <= 0) {
      return NextResponse.json({ error: 'Valor do produto invalido.' }, { status: 400 })
    }

    if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
      return NextResponse.json({ error: 'Comissao configurada fora do intervalo permitido.' }, { status: 409 })
    }

    const mainWalletId = process.env.ASAAS_MAIN_WALLET_ID?.trim() || null
    const producerUsesMainWallet = sameWallet(producerAccount.wallet_id, mainWalletId)

    if (affiliateWalletId && sameWallet(affiliateWalletId, producerAccount.wallet_id)) {
      return NextResponse.json({ error: 'Produtor e afiliado nao podem utilizar a mesma carteira Asaas.' }, { status: 409 })
    }

    if (affiliateWalletId && sameWallet(affiliateWalletId, mainWalletId)) {
      return NextResponse.json({ error: 'Afiliado nao pode utilizar a carteira principal da Flowyn.' }, { status: 409 })
    }

    if (affiliateId && !affiliateWalletId) {
      return NextResponse.json({ error: 'Afiliado ainda não conectou a carteira Asaas.' }, { status: 409 })
    }

    const customerPayload = {
      name: customerName,
      cpfCnpj: customerDocument,
      email: customerEmail,
      mobilePhone: customerPhone,
      externalReference: customerEmail,
      notificationDisabled: true,
    }

    const asaasCustomer = await createCustomer(customerPayload, process.env.ASAAS_API_KEY!)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        product_id: product.id,
        plan_id: plan.id,
        affiliate_id: affiliateId,
        customer_name: firstName(customerName),
        customer_email: maskEmail(customerEmail),
        amount: totalAmount,
        commission_rate: affiliateId ? commissionRate : 0,
        commission_amount: commissionAmount,
        producer_amount: Number((totalAmount - commissionAmount).toFixed(2)),
        status: 'pending',
        asaas_customer_id: asaasCustomer.id,
        payment_provider: 'asaas',
        tracking_id: trackingId,
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

    const split: Array<{ walletId: string; percentualValue: number }> = []

    if (producerUsesMainWallet) {
      if (affiliateWalletId && commissionRate > 0) {
        split.push({ walletId: affiliateWalletId, percentualValue: commissionRate })
      }
    } else {
      const producerSplitRate = affiliateWalletId && commissionRate > 0
        ? Number((100 - commissionRate).toFixed(2))
        : 100
      split.push({ walletId: producerAccount.wallet_id, percentualValue: producerSplitRate })

      if (affiliateWalletId && commissionRate > 0) {
        split.push({ walletId: affiliateWalletId, percentualValue: commissionRate })
      }
    }

    const payment = await createCreditCardPayment({
      customer: asaasCustomer.id,
      billingType: 'CREDIT_CARD',
      value: totalAmount,
      dueDate: today(),
      description: `${product.name} - ${plan.name}`,
      externalReference: order.id,
      ...(split.length > 0 ? { split } : {}),
      creditCard: {
        holderName: String(body.card?.holderName || '').trim(),
        number: cardNumber,
        expiryMonth: String(body.card?.expiryMonth || '').padStart(2, '0'),
        expiryYear: String(body.card?.expiryYear || ''),
        ccv: cardCcv,
      },
      creditCardHolderInfo: {
        name: String(body.holder?.name || customerName).trim(),
        email: String(body.holder?.email || customerEmail).trim(),
        cpfCnpj: onlyDigits(body.holder?.cpfCnpj || customerDocument),
        postalCode: onlyDigits(body.holder?.postalCode),
        addressNumber: String(body.holder?.addressNumber || '').trim(),
        addressComplement: String(body.holder?.addressComplement || '').trim() || null,
        mobilePhone: onlyDigits(body.holder?.mobilePhone || customerPhone),
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
    })
  } catch (err: any) {
    console.error('[Asaas Checkout] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao processar pagamento.' }, { status: 500 })
  }
}
