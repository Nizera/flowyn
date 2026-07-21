import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getDecryptedToken } from '@/lib/meta-oauth'
import { requireProPlan } from '@/lib/subscription'
import {
  parseMetaRateLimitHeader,
  checkSyncBudget,
  checkAppLevelLimit,
  trackAdAccountUsage,
  APP_LEVEL_CALLS_LIMIT_PER_HOUR,
} from '@/lib/meta-rate-limit'
import { syncAccountFull } from '@/lib/meta-sync'

// CORREÇÃO C3 (auditoria tracking): a rota básica /syncinskiows Insights sem insight_level,
// ad_set_id, ad_id e usa onConflict obsoleto, gerando rows que violam o NOT NULL de
// insight_level e nunca casam com queries downstream (.eq('insight_level','campaign')).
// Agora /sync e /sync-expanded share a mesma implementação canonical (syncAccountFull),
// que grava todos os níveis (campaign/adset/ad) com todos os action_types extras
// (landing_page_view, initiate_checkout, add_to_cart, purchase). Erro C2 do auditor
// (reduceInsights ler campos que basic sync nunca escrevia) fica resolvido por tabela.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireProPlan(user.id)
  } catch {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  // Check app-wide safety limit BEFORE making any API calls
  const { allowed: appAllowed, appUsage } = await checkAppLevelLimit(supabase)
  if (!appAllowed) {
    const resetAt = new Date(new Date().setHours(new Date().getHours() + 1, 0, 0, 0))
    return NextResponse.json({
      error: 'App-wide rate limit exceeded',
      app_usage: appUsage,
      app_max: APP_LEVEL_CALLS_LIMIT_PER_HOUR,
      reset_at: resetAt.toISOString(),
    }, { status: 429 })
  }

  const rawBody = await req.text()
  if (rawBody.length > 4096) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }
  const { ad_account_id } = body as { ad_account_id: string }

  if (!ad_account_id) {
    return NextResponse.json({ error: 'ad_account_id required' }, { status: 400 })
  }

  // Verify user owns this account
  const { data: account, error: accountError } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('ad_account_id', ad_account_id)
    .eq('user_id', user.id)
    .single()

  if (accountError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const accessToken = await getDecryptedToken(ad_account_id, user.id)
  if (!accessToken) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  }

  try {
    // Delegate to the canonical sync implementation (same as /sync-expanded)
    const admin = (await import('@/utils/supabase/admin')).createAdminClient()
    const result = await syncAccountFull(admin, user.id, ad_account_id, accessToken)

    if (result.rateLimitHeader) {
      const metaRateLimitInfo = parseMetaRateLimitHeader(result.rateLimitHeader)
      const budget = checkSyncBudget(metaRateLimitInfo)
      if (!budget.allowed) {
        return NextResponse.json({
          error: 'Meta API rate limit exceeded',
          tier: budget.tier,
          throttle_percentage: budget.throttlePercentage,
          retry_after_seconds: budget.retryAfterSeconds,
          meta_limit: true,
          rows_synced: result.totalRowsSynced,
        }, { status: 429 })
      }
    }

    // CORREÇÃO W6-sync (auditoria tracking): trackAdAccountUsage agora aceita o nome do
    // endpoint explicitamente para distinguish /sync de /sync-expanded no analytics.
    await trackAdAccountUsage(user.id, ad_account_id, result.totalApiCalls, result.rateLimitHeader, 'sync')

    // Update last sync timestamp
    await supabase
      .from('ad_accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', account.id)

    // Get updated app-wide usage
    const { appUsage: updatedAppUsage } = await checkAppLevelLimit(supabase)

    return NextResponse.json({
      success: true,
      account_id: ad_account_id,
      rows_synced: result.totalRowsSynced,
      synced_at: new Date().toISOString(),
      errors: result.errors,
      api_usage: {
        app_current: updatedAppUsage,
        app_max: APP_LEVEL_CALLS_LIMIT_PER_HOUR,
        app_remaining: APP_LEVEL_CALLS_LIMIT_PER_HOUR - updatedAppUsage,
        reset_at: new Date(new Date().setHours(new Date().getHours() + 1, 0, 0, 0)).toISOString(),
      },
    })
  } catch (err) {
    console.error('[Meta Sync] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Toggle sync_enabled for an account
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireProPlan(user.id)
  } catch {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const rawBody = await req.text()
  if (rawBody.length > 4096) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }
  const { ad_account_id, sync_enabled } = body as { ad_account_id: string; sync_enabled: boolean }

  if (!ad_account_id || sync_enabled === undefined) {
    return NextResponse.json({ error: 'ad_account_id and sync_enabled required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('ad_accounts')
    .update({ sync_enabled })
    .eq('ad_account_id', ad_account_id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[Meta Sync PATCH] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ success: true, sync_enabled })
}

// GET: Return current API usage
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireProPlan(user.id)
  } catch {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const { appUsage } = await checkAppLevelLimit(supabase)

  return NextResponse.json({
    app_current_usage: appUsage,
    app_max_calls: APP_LEVEL_CALLS_LIMIT_PER_HOUR,
    app_remaining: APP_LEVEL_CALLS_LIMIT_PER_HOUR - appUsage,
    reset_at: new Date(new Date().setHours(new Date().getHours() + 1, 0, 0, 0)).toISOString(),
  })
}
