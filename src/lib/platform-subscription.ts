import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'

const PAID_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_RECEIVED_IN_CASH'])
const FAILED_EVENTS = new Set([
  'PAYMENT_OVERDUE',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
])

type PaymentPayload = {
  id?: unknown
  status?: unknown
  subscription?: unknown
  externalReference?: unknown
  value?: unknown
  dueDate?: unknown
  paymentDate?: unknown
  confirmedDate?: unknown
}

function addMonths(date: Date, months: number) {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

export async function processPlatformSubscriptionPayment(eventType: string, payment: PaymentPayload) {
  const asaasSubscriptionId = payment.subscription ? String(payment.subscription) : null
  if (!asaasSubscriptionId) return false

  const admin = createAdminClient()
  const { data: subscription } = await admin
    .from('platform_subscriptions')
    .select('id, user_id, status')
    .eq('asaas_subscription_id', asaasSubscriptionId)
    .maybeSingle()

  if (!subscription) return false

  const paymentId = payment.id ? String(payment.id) : null
  const now = new Date()

  if (paymentId) {
    await admin.from('platform_subscription_invoices').upsert({
      platform_subscription_id: subscription.id,
      asaas_payment_id: paymentId,
      status: payment.status ? String(payment.status) : eventType,
      value: typeof payment.value === 'number' ? payment.value : null,
      due_date: payment.dueDate ? String(payment.dueDate) : null,
      paid_at: PAID_EVENTS.has(eventType)
        ? String(payment.paymentDate || payment.confirmedDate || now.toISOString())
        : null,
      updated_at: now.toISOString(),
    }, { onConflict: 'asaas_payment_id' })
  }

  if (PAID_EVENTS.has(eventType)) {
    await admin
      .from('platform_subscriptions')
      .update({
        status: 'active',
        last_payment_status: payment.status ? String(payment.status) : eventType,
        current_period_ends_at: addMonths(now, 1).toISOString(),
        grace_period_ends_at: null,
        updated_at: now.toISOString(),
      })
      .eq('id', subscription.id)

    await admin
      .from('profiles')
      .update({ plan: 'pro', updated_at: now.toISOString() })
      .eq('id', subscription.user_id)
  } else if (FAILED_EVENTS.has(eventType)) {
    await admin
      .from('platform_subscriptions')
      .update({
        status: 'grace_period',
        last_payment_status: payment.status ? String(payment.status) : eventType,
        grace_period_ends_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', subscription.id)
  } else if (eventType === 'PAYMENT_REFUNDED') {
    await admin
      .from('platform_subscriptions')
      .update({
        status: 'suspended',
        last_payment_status: payment.status ? String(payment.status) : eventType,
        updated_at: now.toISOString(),
      })
      .eq('id', subscription.id)

    await admin
      .from('profiles')
      .update({ plan: 'free', updated_at: now.toISOString() })
      .eq('id', subscription.user_id)
  }

  return true
}

