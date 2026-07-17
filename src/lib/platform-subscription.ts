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

  let existingInvoice: { paid_at: string | null } | null = null
  if (paymentId) {
    const { data: invoice } = await admin
      .from('platform_subscription_invoices')
      .select('paid_at')
      .eq('asaas_payment_id', paymentId)
      .maybeSingle()
    existingInvoice = invoice

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
    if (existingInvoice?.paid_at) {
      return true
    }

    if (subscription.status === 'cancelled' || subscription.status === 'suspended') {
      return true
    }

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

    // ── Referral commission: 20% of net value (R$97), one-time per referral ──
    try {
      const { data: userProfile } = await admin
        .from('profiles')
        .select('referred_by')
        .eq('id', subscription.user_id)
        .maybeSingle()

      if (userProfile?.referred_by) {
        // Find or create referral record
        let referralId: string | null = null
        const { data: existingReferral } = await admin
          .from('referrals')
          .select('id')
          .eq('referrer_id', userProfile.referred_by)
          .eq('referred_id', subscription.user_id)
          .maybeSingle()

        if (existingReferral) {
          referralId = existingReferral.id
        } else {
          const { data: newReferral } = await admin
            .from('referrals')
            .insert({
              referral_code: 'PLATFORM',
              referrer_id: userProfile.referred_by,
              referred_id: subscription.user_id,
            })
            .select('id')
            .maybeSingle()
          if (newReferral) referralId = newReferral.id
        }

        // Create commission on EVERY payment (recurring 20%)
        // UNIQUE(payment_id) prevents duplicates
        if (referralId && paymentId) {
          const paidValue = Number(payment.value) || 97
          const commissionAmount = Math.round(paidValue * 20) / 100

          if (commissionAmount > 0) {
            const { error: commissionError } = await admin.from('referral_commissions').insert({
              referral_id: referralId,
              payment_id: paymentId,
              amount: commissionAmount,
              status: 'pending',
            })

            if (!commissionError) {
              console.log(`[Referral] Commission R$${commissionAmount} for payment ${paymentId}`)
            }
          }
        }
      }
    } catch (referralError) {
      console.error('[Referral] Commission error (non-blocking):', referralError)
    }
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

    // Cancel pending referral commission for this specific payment
    if (paymentId) {
      await admin
        .from('referral_commissions')
        .update({ status: 'cancelled' })
        .eq('payment_id', paymentId)
        .eq('status', 'pending')
    }
  }

  return true
}

