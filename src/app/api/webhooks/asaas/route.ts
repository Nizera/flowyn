import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { fulfillPaidOrder, revokePaidOrder } from '@/lib/order-fulfillment'
import { processPlatformSubscriptionPayment } from '@/lib/platform-subscription'
import { createAdminClient } from '@/utils/supabase/admin'

function safeTokenEqual(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

const PAID_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_RECEIVED_IN_CASH'])
const FAILED_EVENTS = new Set([
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
])
const REFUND_EVENTS = new Set([
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_REFUND_DENIED',
])
const CHARGEBACK_EVENTS = new Set([
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
])
const SPLIT_EVENTS = new Set([
  'PAYMENT_SPLIT_CANCELLED',
  'PAYMENT_SPLIT_DIVERGENCE_BLOCK',
  'PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED',
])

type PaymentPayload = {
  id?: unknown
  externalReference?: unknown
  status?: unknown
  billingType?: unknown
  value?: unknown
  subscription?: unknown
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : 'Unexpected webhook processing error'
}

function getOrderId(externalReference: unknown) {
  const value = externalReference ? String(externalReference) : ''
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

function sanitizePayload(eventType: string, payment: PaymentPayload) {
  return {
    event: eventType,
    payment: {
      id: payment.id ? String(payment.id) : null,
      externalReference: payment.externalReference ? String(payment.externalReference) : null,
      status: payment.status ? String(payment.status) : null,
      billingType: payment.billingType ? String(payment.billingType) : null,
      value: typeof payment.value === 'number' ? payment.value : null,
      subscription: payment.subscription ? String(payment.subscription) : null,
    },
  }
}

function getOrderStatus(eventType: string) {
  if (eventType === 'PAYMENT_REFUNDED') return 'refunded'
  if (eventType === 'PAYMENT_PARTIALLY_REFUNDED') return 'partially_refunded'
  if (eventType === 'PAYMENT_REFUND_IN_PROGRESS') return 'refund_in_progress'
  if (eventType === 'PAYMENT_CHARGEBACK_REQUESTED') return 'chargeback_requested'
  if (eventType === 'PAYMENT_CHARGEBACK_DISPUTE') return 'chargeback_dispute'
  if (eventType === 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL') return 'chargeback_reversal_pending'
  if (FAILED_EVENTS.has(eventType)) return 'failed'
  return null
}

function getTransferStatus(eventType: string) {
  if (eventType === 'PAYMENT_SPLIT_CANCELLED') return 'split_cancelled'
  if (eventType === 'PAYMENT_SPLIT_DIVERGENCE_BLOCK') return 'split_blocked'
  if (eventType === 'PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED') return 'split_block_finished'
  return null
}

export async function POST(req: NextRequest) {
  const expectedToken = process.env.ASAAS_WEBHOOK_SECRET
  const receivedToken = req.headers.get('asaas-access-token')

  if (!expectedToken) {
    console.error('[Asaas Webhook] ASAAS_WEBHOOK_SECRET is not configured.')
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 })
  }

  if (!receivedToken || !safeTokenEqual(receivedToken, expectedToken)) {
    return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 })
  }

  let payload: { id?: unknown; event?: unknown; payment?: PaymentPayload }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const eventId = payload.id ? String(payload.id) : ''
  const eventType = payload.event ? String(payload.event) : ''
  const payment = payload.payment || {}
  const paymentId = payment.id ? String(payment.id) : null
  const orderId = getOrderId(payment.externalReference)

  if (!eventId || !eventType) {
    return NextResponse.json({ error: 'Webhook event id and type are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const sanitizedPayload = sanitizePayload(eventType, payment)
  const { error: insertError } = await supabase
    .from('asaas_webhook_events')
    .insert({
      event_id: eventId,
      event_type: eventType,
      payment_id: paymentId,
      order_id: orderId,
      payload: sanitizedPayload,
      status: 'pending',
    })

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: existing } = await supabase
        .from('asaas_webhook_events')
        .select('event_id, status')
        .eq('event_id', eventId)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ received: true, duplicate: true, status: existing.status })
      }
    }

    console.error('[Asaas Webhook] Could not persist event.')
    return NextResponse.json({ error: 'Could not persist webhook event' }, { status: 500 })
  }

  await supabase
    .from('asaas_webhook_events')
    .update({ status: 'failed', last_error: 'Recovered after stale processing timeout.' })
    .eq('event_id', eventId)
    .eq('status', 'processing')
    .lt('processing_started_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())

  const { data: claimedEvent } = await supabase
    .from('asaas_webhook_events')
    .update({
      status: 'processing',
      processing_started_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('event_id', eventId)
    .in('status', ['pending', 'failed'])
    .select('event_id, attempt_count')
    .maybeSingle()

  if (!claimedEvent) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    const platformSubscriptionHandled = await processPlatformSubscriptionPayment(eventType, payment)

    if (!platformSubscriptionHandled && orderId && paymentId) {
      const orderUpdate: Record<string, string> = {
        asaas_payment_id: paymentId,
        asaas_status: payment.status ? String(payment.status) : eventType,
        updated_at: new Date().toISOString(),
      }
      const orderStatus = getOrderStatus(eventType)
      const transferStatus = getTransferStatus(eventType)

      if (orderStatus) orderUpdate.status = orderStatus
      if (transferStatus) orderUpdate.transfer_status = transferStatus

      await supabase.from('orders').update(orderUpdate).eq('id', orderId)
    }

    if (!platformSubscriptionHandled && orderId && PAID_EVENTS.has(eventType)) {
      const { data: orderAmountRow } = await supabase
        .from('orders')
        .select('amount')
        .eq('id', orderId)
        .maybeSingle()

      const expectedAmount = orderAmountRow ? Number(orderAmountRow.amount) : null
      const paidAmount = typeof payment.value === 'number' ? payment.value : null

      if (expectedAmount === null || paidAmount === null || Math.abs(expectedAmount - paidAmount) > 0.01) {
        await supabase.from('security_audit_log').insert({
          action: 'PAYMENT_VALUE_MISMATCH',
          entity_type: 'order',
          entity_id: orderId,
          metadata: { payment_id: paymentId, expected_amount: expectedAmount, paid_amount: paidAmount },
        })
      } else {
        await fulfillPaidOrder(supabase, orderId, payment.status ? String(payment.status) : eventType)
      }
    }

    if (!platformSubscriptionHandled && orderId && (REFUND_EVENTS.has(eventType) || CHARGEBACK_EVENTS.has(eventType) || SPLIT_EVENTS.has(eventType))) {
      const revokeResult = await revokePaidOrder(supabase, orderId, eventType)
      await supabase.from('security_audit_log').insert({
        action: eventType,
        entity_type: 'order',
        entity_id: orderId,
        metadata: { payment_id: paymentId, access_revoked: !revokeResult.skipped },
      })
    }

    await supabase
      .from('asaas_webhook_events')
      .update({
        status: 'done',
        processed_at: new Date().toISOString(),
        attempt_count: Number(claimedEvent.attempt_count || 0) + 1,
      })
      .eq('event_id', eventId)

    return NextResponse.json({ received: true })
  } catch (error) {
    const message = safeErrorMessage(error)
    await supabase
      .from('asaas_webhook_events')
      .update({
        status: 'failed',
        attempt_count: Number(claimedEvent.attempt_count || 0) + 1,
        last_error: message,
      })
      .eq('event_id', eventId)

    console.error('[Asaas Webhook] Processing failed.')
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
  }
}
