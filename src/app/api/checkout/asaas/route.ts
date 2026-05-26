import { NextRequest, NextResponse } from 'next/server'
import {
  createCreditCardPayment,
  createCustomer,
  onlyDigits,
  updateCustomer,
} from '@/lib/asaas'
import { fulfillPaidOrder } from '@/lib/order-fulfillment'
import { createAdminClient } from '@/utils/supabase/admin'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return req.headers.get('x-real-ip') || '127.0.0.1'
}

const PAID_STATUSES = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'])

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()

  try {
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
    const { data: producerAccount } = await supabase
      .from('payment_accounts')
      .select('api_key, wallet_id')
      .eq('user_id', product.owner_id)
      .eq('provider', 'asaas')
      .single()

    if (!producerAccount?.api_key || !producerAccount?.wallet_id) {
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

    let asaasCustomer
    if (body.asaas_customer_id) {
      asaasCustomer = await updateCustomer(String(body.asaas_customer_id), customerPayload, producerAccount.api_key)
    } else {
      asaasCustomer = await createCustomer(customerPayload, producerAccount.api_key)
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        product_id: product.id,
        plan_id: plan.id,
        affiliate_id: affiliateId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_document: customerDocument,
        customer_phone: customerPhone,
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

    const split = affiliateWalletId && commissionRate > 0
      ? [{ walletId: affiliateWalletId, percentualValue: commissionRate }]
      : undefined

    const payment = await createCreditCardPayment({
      customer: asaasCustomer.id,
      billingType: 'CREDIT_CARD',
      value: totalAmount,
      dueDate: today(),
      description: `${product.name} - ${plan.name}`,
      externalReference: order.id,
      split,
      creditCard: {
        holderName: String(body.card?.holderName || '').trim(),
        number: onlyDigits(body.card?.number),
        expiryMonth: String(body.card?.expiryMonth || '').padStart(2, '0'),
        expiryYear: String(body.card?.expiryYear || ''),
        ccv: onlyDigits(body.card?.ccv),
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
      remoteIp: getClientIp(req),
    }, producerAccount.api_key)

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
