import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDecryptedToken } from '@/lib/meta-oauth'
import { requireProPlan } from '@/lib/subscription'
import { syncAccountFull } from '@/lib/meta-sync'
import {
  parseMetaRateLimitHeader,
  checkSyncBudget,
  checkAppLevelLimit,
  trackAdAccountUsage,
  APP_LEVEL_CALLS_LIMIT_PER_HOUR,
} from '@/lib/meta-rate-limit'

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

  // Check app-wide safety limit
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

  const body = await req.json()
  const { ad_account_id } = body

  if (!ad_account_id) {
    return NextResponse.json({ error: 'ad_account_id required' }, { status: 400 })
  }

  // Verify user owns this account
  const { data: account } = await supabase
    .from('ad_accounts')
    .select('id, ad_account_id')
    .eq('ad_account_id', ad_account_id)
    .eq('user_id', user.id)
    .single()

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const accessToken = await getDecryptedToken(ad_account_id, user.id)
  if (!accessToken) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  }

  const startTime = Date.now()

  try {
    const syncResult = await syncAccountFull(createAdminClient(), user.id, ad_account_id, accessToken)

    // Check Meta rate limit from last response
    const budget = checkSyncBudget(parseMetaRateLimitHeader(syncResult.rateLimitHeader))

    // Record usage
    await trackAdAccountUsage(user.id, ad_account_id, syncResult.totalApiCalls, syncResult.rateLimitHeader)

    // Update last sync timestamp
    await supabase
      .from('ad_accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', account.id)

    // Log sync
    await supabase.from('sync_logs').insert({
      user_id: user.id,
      ad_account_id,
      sync_type: 'full',
      status: syncResult.errors.length > 0 ? 'partial' : 'completed',
      api_calls_made: syncResult.totalApiCalls,
      rows_synced: syncResult.totalRowsSynced,
      error_message: syncResult.errors.length > 0 ? syncResult.errors.join('; ') : null,
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    })

    // Get updated app-wide usage
    const { appUsage: updatedAppUsage } = await checkAppLevelLimit(supabase)

    return NextResponse.json({
      success: true,
      account_id: ad_account_id,
      rows_synced: syncResult.totalRowsSynced,
      api_calls_made: syncResult.totalApiCalls,
      errors: syncResult.errors.length > 0 ? syncResult.errors : undefined,
      duration_ms: Date.now() - startTime,
      synced_at: new Date().toISOString(),
      api_usage: {
        app_current: updatedAppUsage,
        app_max: APP_LEVEL_CALLS_LIMIT_PER_HOUR,
        app_remaining: APP_LEVEL_CALLS_LIMIT_PER_HOUR - updatedAppUsage,
        reset_at: new Date(new Date().setHours(new Date().getHours() + 1, 0, 0, 0)).toISOString(),
      },
      meta_rate_limit: budget.tier !== 'unknown' ? {
        tier: budget.tier,
        throttle_percentage: budget.throttlePercentage,
        app_util_pct: parseMetaRateLimitHeader(syncResult.rateLimitHeader)?.app_id_util_pct || 0,
        account_util_pct: parseMetaRateLimitHeader(syncResult.rateLimitHeader)?.acc_id_util_pct || 0,
      } : null,
    })
  } catch (err: any) {
    // Log failed sync
    await supabase.from('sync_logs').insert({
      user_id: user.id,
      ad_account_id,
      sync_type: 'full',
      status: 'failed',
      api_calls_made: 0,
      rows_synced: 0,
      error_message: err.message?.slice(0, 500),
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    })

    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
