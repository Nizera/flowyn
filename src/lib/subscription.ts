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

/**
 * Conta recursos (produtos ou checkouts publicados) do user.
 * BUG FIX: antes contava TODOS os produtos (incluindo inativos). Agora conta
 * apenas produtos ativos (is_active = true), já que o limite é sobre produtos ativos.
 */
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
      .eq('is_active', true)
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
        .not('published_at', 'is', null)
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
    .select('status, trial_ends_at, current_period_ends_at, grace_period_ends_at')
    .eq('user_id', userId)
    .maybeSingle()

  const now = new Date()
  const isTrialing =
    (subscription?.status === 'scheduled' || subscription?.status === 'trialing') &&
    subscription.trial_ends_at &&
    new Date(subscription.trial_ends_at).getTime() > now.getTime()

  const isGracePeriod =
    subscription?.status === 'grace_period' &&
    subscription.grace_period_ends_at &&
    new Date(subscription.grace_period_ends_at).getTime() > now.getTime()

  const periodNotExpired =
    subscription?.current_period_ends_at != null &&
    new Date(subscription.current_period_ends_at).getTime() > now.getTime()

  const hasActiveRow =
    (subscription?.status === 'active' && periodNotExpired) ||
    (subscription?.status === 'cancelled' && periodNotExpired) ||
    isTrialing ||
    isGracePeriod

  const effectivePlan: UserPlan = hasActiveRow ? (plan === 'free' ? 'pro' : plan) : 'free'
  const isActive = hasActiveRow && effectivePlan !== 'free'

  return {
    plan: effectivePlan,
    isActive,
    trialEndsAt: subscription?.trial_ends_at || null,
    currentPeriodEndsAt: subscription?.current_period_ends_at || null,
  }
}

/**
 * Enforcement: quando o plano cai pra free, desabilita todos os produtos
 * excedentes. Mantém apenas os `maxProducts` mais recentes ativos.
 * Chamado pelo grace-period cron e pelo webhook de cancellation.
 */
export async function enforcePlanLimits(userId: string): Promise<{ disabled: number }> {
  const admin = createAdminClient()
  const check = await checkSubscription(userId)
  const limits = PLAN_LIMITS[check.plan]

  if (check.plan !== 'free') return { disabled: 0 }

  const maxProducts = limits.maxProducts // 1 para free

  // Pega todos os produtos ativos, ordenados por created_at (mais recente primeiro)
  const { data: activeProducts } = await admin
    .from('products')
    .select('id')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (!activeProducts || activeProducts.length <= maxProducts) return { disabled: 0 }

  // Desabilita todos exceto os N mais recentes
  const productsToDisable = activeProducts.slice(maxProducts)
  const idsToDisable = productsToDisable.map(p => p.id)

  const { error } = await admin
    .from('products')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in('id', idsToDisable)

  if (error) {
    console.error('[enforcePlanLimits] Failed to disable products:', error.message)
    return { disabled: 0 }
  }

  return { disabled: idsToDisable.length }
}

export async function requireProPlan(userId: string): Promise<SubscriptionCheck> {
  const check = await checkSubscription(userId)
  if (!check.isActive) {
    throw new Error('SUBSCRIPTION_REQUIRED')
  }
  return check
}
