import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'

export type UserPlan = 'free' | 'pro' | 'scale'

export type SubscriptionCheck = {
  plan: UserPlan
  isActive: boolean
  trialEndsAt: string | null
  currentPeriodEndsAt: string | null
}

export async function checkSubscription(userId: string): Promise<SubscriptionCheck> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle()

  const plan = (profile?.plan as UserPlan) || 'free'

  const { data: subscription } = await admin
    .from('platform_subscriptions')
    .select('status, trial_ends_at, current_period_ends_at')
    .eq('user_id', userId)
    .maybeSingle()

  const now = new Date()
  const isTrialing =
    (subscription?.status === 'scheduled' || subscription?.status === 'trialing') &&
    subscription.trial_ends_at &&
    new Date(subscription.trial_ends_at).getTime() > now.getTime()

  const isGracePeriod = subscription?.status === 'grace_period'

  const isActive =
    subscription?.status === 'active' ||
    isTrialing ||
    isGracePeriod ||
    (plan !== 'free')

  return {
    plan,
    isActive,
    trialEndsAt: subscription?.trial_ends_at || null,
    currentPeriodEndsAt: subscription?.current_period_ends_at || null,
  }
}

export async function requireProPlan(userId: string): Promise<SubscriptionCheck> {
  const check = await checkSubscription(userId)
  if (!check.isActive && check.plan === 'free') {
    throw new Error('SUBSCRIPTION_REQUIRED')
  }
  return check
}
