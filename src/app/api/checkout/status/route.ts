import { NextRequest, NextResponse } from 'next/server'
import { retrievePayment } from '@/lib/asaas'
import { hashIdentifier } from '@/lib/hash'
import { fulfillPaidOrder } from '@/lib/order-fulfillment'
import { createAdminClient } from '@/utils/supabase/admin'
import { decryptApiKey } from '@/lib/encryption'

const PAID_STATUSES = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'])
const FAILED_STATUSES = new Set(['REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE'])

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return req.headers.get('x-real-ip') || '127.0.0.1'
}

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('order_id') || ''
  if (!isUuid(orderId)) {
    return NextResponse.json({ error: 'Pedido invalido.' }, { status: 400 })
  }

  const customerEmail = req.nextUrl.searchParams.get('customer_email') || ''
  if (!customerEmail) {
    return NextResponse.json({ error: 'E-mail do cliente é obrigatório.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const clientIp = getClientIp(req)
  const { data: withinRateLimit, error: rateLimitError } = await supabase.rpc('consume_rate_limit', {
    requested_bucket: 'checkout_status',
    requested_identifier_hash: await hashIdentifier(clientIp),
    max_requests: 60,
    window_seconds: 60,
  })

  if (rateLimitError || !withinRateLimit) {
    return NextResponse.json({ error: 'Aguarde alguns segundos antes de verificar novamente.' }, { status: 429 })
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, asaas_payment_id, asaas_status, product_id')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: 'Pedido nao encontrado.' }, { status: 404 })
  }

  const { data: privateCustomer } = await supabase
    .from('order_customer_private')
    .select('customer_email')
    .eq('order_id', orderId)
    .maybeSingle()

  if (!privateCustomer || privateCustomer.customer_email.trim().toLowerCase() !== customerEmail.trim().toLowerCase()) {
    return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  }

  if (order.status === 'paid') {
    return NextResponse.json({ paid: true, status: order.asaas_status || 'RECEIVED' })
  }

  if (!order.asaas_payment_id) {
    return NextResponse.json({ paid: false, status: order.status || 'PENDING' })
  }

  let apiKey = process.env.ASAAS_API_KEY

  if (order.product_id) {
    const { data: product } = await supabase
      .from('products')
      .select('owner_id')
      .eq('id', order.product_id)
      .maybeSingle()

    if (product?.owner_id) {
      const { data: producerAccount } = await supabase
        .from('payment_accounts')
        .select('api_key, connection_mode')
        .eq('user_id', product.owner_id)
        .eq('provider', 'asaas')
        .maybeSingle()

      if (producerAccount?.connection_mode === 'standalone' && producerAccount?.api_key) {
        apiKey = decryptApiKey(producerAccount.api_key)
      }
    }
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Consulta de pagamento indisponivel.' }, { status: 503 })
  }

  try {
    const payment = await retrievePayment(order.asaas_payment_id, apiKey)
    if (payment.externalReference && payment.externalReference !== orderId) {
      return NextResponse.json({ error: 'Cobranca nao pertence a este pedido.' }, { status: 409 })
    }

    if (PAID_STATUSES.has(payment.status)) {
      if (order.status !== 'paid') {
        await supabase
          .from('orders')
          .update({
            asaas_status: payment.status,
            net_value: typeof (payment as any).netValue === 'number' ? (payment as any).netValue : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId)

        await fulfillPaidOrder(supabase, orderId, payment.status)
      }
      return NextResponse.json({ paid: true, status: payment.status })
    }

    const failed = FAILED_STATUSES.has(payment.status)
    await supabase
      .from('orders')
      .update({
        asaas_status: payment.status,
        ...(failed ? { status: 'failed' } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    return NextResponse.json({ paid: false, failed, status: payment.status })
  } catch (error) {
    console.error('[Asaas Checkout Status] Query failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Nao foi possivel consultar o pagamento agora.' }, { status: 502 })
  }
}
