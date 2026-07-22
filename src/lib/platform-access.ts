import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'

export type PlatformSubscriptionStatus =
  | 'trialing'
  | 'scheduled'
  | 'active'
  | 'grace_period'
  | 'suspended'
  | 'cancelled'

export type PlatformAccess = {
  allowed: boolean
  status: PlatformSubscriptionStatus
  trialEndsAt: string | null
  gracePeriodEndsAt: string | null
}

function isFuture(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now())
}

export async function getPlatformAccess(userId: string): Promise<PlatformAccess> {
  const admin = createAdminClient()
  const { data: subscription } = await admin
    .from('platform_subscriptions')
    .select('status, trial_ends_at, current_period_ends_at, grace_period_ends_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!subscription) {
    return { allowed: false, status: 'suspended', trialEndsAt: null, gracePeriodEndsAt: null }
  }

  const status = subscription.status as PlatformSubscriptionStatus
  const periodNotExpired =
    subscription.current_period_ends_at != null &&
    isFuture(subscription.current_period_ends_at)

  const allowed =
    (status === 'active' && periodNotExpired)
    || (status === 'cancelled' && periodNotExpired)
    || ((status === 'trialing' || status === 'scheduled') && isFuture(subscription.trial_ends_at))
    || (status === 'grace_period' && isFuture(subscription.grace_period_ends_at))

  return {
    allowed,
    status,
    trialEndsAt: subscription.trial_ends_at,
    gracePeriodEndsAt: subscription.grace_period_ends_at,
  }
}

