import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { retrievePayment } from '@/lib/asaas'
import { decryptApiKey } from '@/lib/encryption'
import { fulfillPaidOrder } from '@/lib/order-fulfillment'
import { safeBearerCompare } from '@/lib/safe-bearer-compare'

export const dynamic = 'force-dynamic'

const PAID_STATUSES = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'])

export async function POST(req: NextRequest) {
  const secret = process.env.REPROCESS_SECRET || process.env.ASAAS_WEBHOOK_SECRET
  const authHeader = req.headers.get('authorization') || ''
  if (!secret || !safeBearerCompare(authHeader, secret)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let body: { order_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido.' }, { status: 400 })
  }

  const orderId = body.order_id
  if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    return NextResponse.json({ error: 'order_id invalido.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, asaas_payment_id, asaas_subscription_id, product_id')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido nao encontrado.' }, { status: 404 })
  }

  if (order.status === 'paid') {
    return NextResponse.json({ message: 'Pedido ja esta pago.', order_id: orderId, status: order.status })
  }

  if (!order.asaas_payment_id && !order.asaas_subscription_id) {
    return NextResponse.json({ error: 'Pedido nao tem pagamento Asaas associado.' }, { status: 400 })
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
    return NextResponse.json({ error: 'API key Asaas nao disponivel.' }, { status: 503 })
  }

  const paymentId = order.asaas_payment_id || order.asaas_subscription_id

  try {
    const payment = await retrievePayment(paymentId!, apiKey)
    const paymentStatus = payment.status ? String(payment.status) : null

    await supabase.from('security_audit_log').insert({
      action: 'ADMIN_REPROCESS_ORDER',
      entity_type: 'order',
      entity_id: orderId,
      metadata: {
        payment_id: paymentId,
        asaas_status: paymentStatus,
        previous_order_status: order.status,
      },
    })

    if (!paymentStatus || !PAID_STATUSES.has(paymentStatus)) {
      return NextResponse.json({
        message: 'Pagamento nao esta confirmado na Asaas.',
        order_id: orderId,
        asaas_status: paymentStatus,
        action_taken: false,
      })
    }

    const result = await fulfillPaidOrder(supabase, orderId, paymentStatus)

    return NextResponse.json({
      message: 'Pedido reprocessado com sucesso.',
      order_id: orderId,
      asaas_status: paymentStatus,
      action_taken: !result.skipped,
      error: result.error || null,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message.slice(0, 300) : 'Erro desconhecido'
    console.error('[Admin Reprocess] Error:', msg)
    return NextResponse.json({ error: 'Erro ao consultar pagamento na Asaas.', detail: msg }, { status: 502 })
  }
}
