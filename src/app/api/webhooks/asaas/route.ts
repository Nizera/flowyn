import { NextRequest, NextResponse } from 'next/server'
import { fulfillPaidOrder } from '@/lib/order-fulfillment'
import { createAdminClient } from '@/utils/supabase/admin'

function getAdminClient() {
  return createAdminClient()
}

const PAID_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_RECEIVED_IN_CASH'])
const FAILED_EVENTS = new Set([
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_REFUNDED',
  'PAYMENT_CHARGEBACK_REQUESTED',
])

export async function POST(req: NextRequest) {
  const expectedToken = process.env.ASAAS_WEBHOOK_SECRET
  const receivedToken = req.headers.get('asaas-access-token') || req.headers.get('asaas_access_token')

  if (expectedToken && receivedToken !== expectedToken) {
    return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 })
  }

  const payload = await req.json()
  const eventType = String(payload.event || '')
  const payment = payload.payment || {}
  const paymentId = payment.id ? String(payment.id) : null
  const orderId = payment.externalReference ? String(payment.externalReference) : null
  const eventId = payload.id ? String(payload.id) : `${eventType}:${paymentId || orderId || crypto.randomUUID()}`
  const supabase = getAdminClient()

  const { error: insertError } = await supabase
    .from('asaas_webhook_events')
    .insert({
      event_id: eventId,
      event_type: eventType,
      payment_id: paymentId,
      order_id: orderId,
      payload,
    })

  if (insertError?.code === '23505') {
    return NextResponse.json({ received: true, duplicate: true })
  }

  if (insertError) {
    console.error('[Asaas Webhook] Event log error:', insertError)
  }

  try {
    if (orderId && paymentId) {
      await supabase
        .from('orders')
        .update({
          asaas_payment_id: paymentId,
          asaas_status: payment.status || eventType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
    }

    if (orderId && PAID_EVENTS.has(eventType)) {
      await fulfillPaidOrder(supabase, orderId, payment.status || eventType)
    }

    if (orderId && FAILED_EVENTS.has(eventType)) {
      await supabase
        .from('orders')
        .update({
          status: eventType === 'PAYMENT_REFUNDED' ? 'refunded' : 'failed',
          asaas_status: payment.status || eventType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .neq('status', 'paid')
    }

    await supabase
      .from('asaas_webhook_events')
      .update({ processed_at: new Date().toISOString(), order_id: orderId })
      .eq('event_id', eventId)

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('[Asaas Webhook] Error:', err)
    return NextResponse.json({ error: err.message || 'Webhook processing error' }, { status: 500 })
  }
}
