import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'

export type UserPlan = 'free' | 'pro' | 'scale'

export type SubscriptionCheck = {
  plan: UserPlan
  isActive: boolean
  trialEndsAt: string | null
  currentPeriodEndsAt: string | null
}

export const PLAN_LIMITS = {
  free: { maxProducts: 1, maxPublishedCheckouts: 1 },
  pro: { maxProducts: Infinity, maxPublishedCheckouts: Infinity },
  scale: { maxProducts: Infinity, maxPublishedCheckouts: Infinity },
} as const

export async function checkPlanLimit(
  userId: string,
  resource: 'products' | 'checkouts'
): Promise<{ allowed: boolean; current: number; max: number; plan: UserPlan }> {
  const check = await checkSubscription(userId)
  const limits = PLAN_LIMITS[check.plan]
  const admin = createAdminClient()

  let current = 0
  if (resource === 'products') {
    const { count } = await admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
    current = count ?? 0
  } else {
    const { data: productIds } = await admin
      .from('products')
      .select('id')
      .eq('owner_id', userId)

    if (productIds && productIds.length > 0) {
      const { count } = await admin
        .from('checkout_customizations')
        .select('id', { count: 'exact', head: true })
        .not('published_config', 'is', null)
        .in('product_id', productIds.map(p => p.id))
      current = count ?? 0
    }
  }

  const max = resource === 'products' ? limits.maxProducts : limits.maxPublishedCheckouts
  return { allowed: current < max, current, max, plan: check.plan }
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

  const periodNotExpired =
    !subscription?.current_period_ends_at ||
    new Date(subscription.current_period_ends_at).getTime() > now.getTime()

  const hasActiveRow =
    (subscription?.status === 'active' && periodNotExpired) ||
    (subscription?.status === 'cancelled' && periodNotExpired) ||
    isTrialing ||
    isGracePeriod

  const effectivePlan: UserPlan = hasActiveRow && plan === 'free' ? 'pro' : plan
  const isActive = hasActiveRow && effectivePlan !== 'free'

  return {
    plan: effectivePlan,
    isActive,
    trialEndsAt: subscription?.trial_ends_at || null,
    currentPeriodEndsAt: subscription?.current_period_ends_at || null,
  }
}

export async function requireProPlan(userId: string): Promise<SubscriptionCheck> {
  const check = await checkSubscription(userId)
  if (!check.isActive) {
    throw new Error('SUBSCRIPTION_REQUIRED')
  }
  return check
}
