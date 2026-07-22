import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { safeBearerCompare } from '@/lib/safe-bearer-compare'
import { enforcePlanLimits } from '@/lib/subscription'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || ''
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || !safeBearerCompare(authHeader, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  let suspendedCount = 0
  let downgradeCount = 0
  let productsDisabled = 0

  // 1. Suspend subscriptions past grace period
  const { data: expiredGrace } = await supabase
    .from('platform_subscriptions')
    .select('id, user_id')
    .eq('status', 'grace_period')
    .not('grace_period_ends_at', 'is', null)
    .lt('grace_period_ends_at', new Date().toISOString())

  for (const sub of expiredGrace || []) {
    try {
      await supabase
        .from('platform_subscriptions')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', sub.id)

      await supabase
        .from('profiles')
        .update({ plan: 'free', updated_at: new Date().toISOString() })
        .eq('id', sub.user_id)

      // Enforcement: desabilita produtos excedentes do plano free
      const { disabled } = await enforcePlanLimits(sub.user_id)
      productsDisabled += disabled

      suspendedCount++
    } catch (err) {
      console.error(`[grace-period] Failed to suspend sub ${sub.id}:`, err)
      continue
    }
  }

  // 2. Downgrade cancelled subscriptions whose paid period has ended
  const { data: expiredCancelled } = await supabase
    .from('platform_subscriptions')
    .select('id, user_id')
    .eq('status', 'cancelled')
    .not('current_period_ends_at', 'is', null)
    .lt('current_period_ends_at', new Date().toISOString())

  for (const sub of expiredCancelled || []) {
    try {
      await supabase
        .from('platform_subscriptions')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', sub.id)

      await supabase
        .from('profiles')
        .update({ plan: 'free', updated_at: new Date().toISOString() })
        .eq('id', sub.user_id)

      // Enforcement: desabilita produtos excedentes do plano free
      const { disabled } = await enforcePlanLimits(sub.user_id)
      productsDisabled += disabled

      downgradeCount++
    } catch (err) {
      console.error(`[grace-period] Failed to downgrade sub ${sub.id}:`, err)
      continue
    }
  }

  // 3. Cancelled subscriptions with current_period_ends_at = NULL
  // Estado inconsistente: subscription cancelada mas sem data de fim de período.
  // Trata como expirado imediatamente (não há período restante para conceder).
  const { data: cancelledNoPeriod } = await supabase
    .from('platform_subscriptions')
    .select('id, user_id')
    .eq('status', 'cancelled')
    .is('current_period_ends_at', null)

  for (const sub of cancelledNoPeriod || []) {
    try {
      await supabase
        .from('platform_subscriptions')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', sub.id)

      await supabase
        .from('profiles')
        .update({ plan: 'free', updated_at: new Date().toISOString() })
        .eq('id', sub.user_id)

      const { disabled } = await enforcePlanLimits(sub.user_id)
      productsDisabled += disabled

      downgradeCount++
    } catch (err) {
      console.error(`[grace-period] Failed to downgrade cancelled-no-period sub ${sub.id}:`, err)
      continue
    }
  }

  return NextResponse.json({
    success: true,
    suspended: suspendedCount,
    downgraded: downgradeCount,
    products_disabled: productsDisabled,
    timestamp: new Date().toISOString(),
  })
}
