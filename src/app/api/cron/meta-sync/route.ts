import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDecryptedToken } from '@/lib/meta-oauth'
import { syncAccountFull } from '@/lib/meta-sync'
import {
  parseMetaRateLimitHeader,
  checkSyncBudget,
  checkAppLevelLimit,
  trackAdAccountUsage,
  APP_LEVEL_CALLS_LIMIT_PER_HOUR,
} from '@/lib/meta-rate-limit'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('account_id')

  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Cleanup old API usage records (>24h)
  await supabase
    .from('meta_api_usage')
    .delete()
    .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  let query = supabase
    .from('ad_accounts')
    .select('*')
    .eq('is_active', true)
    .eq('sync_enabled', true)

  if (accountId) {
    query = query.eq('ad_account_id', accountId)
  }

  const { data: adAccounts, error: adAccountsError } = await query

  if (adAccountsError) {
    console.error('[Meta Sync Cron] Database error:', adAccountsError.message)
    return NextResponse.json({ error: adAccountsError.message }, { status: 500 })
  }

  if (!adAccounts || adAccounts.length === 0) {
    return NextResponse.json({ message: 'No enabled ad accounts to sync' })
  }

  // Check app-wide safety limit before starting
  const { allowed: appAllowed, appUsage } = await checkAppLevelLimit(supabase)
  if (!appAllowed) {
    return NextResponse.json({
      error: 'App-wide rate limit exceeded',
      app_usage: appUsage,
      app_max: APP_LEVEL_CALLS_LIMIT_PER_HOUR,
    }, { status: 429 })
  }

  const results: any[] = []
  let totalApiCalls = 0

  for (const account of adAccounts) {
    const accessToken = await getDecryptedToken(account.ad_account_id, account.user_id)
    if (!accessToken) {
      results.push({ account_id: account.ad_account_id, error: 'Token decryption failed' })
      continue
    }

    try {
      const syncResult = await syncAccountFull(supabase, account.user_id, account.ad_account_id, accessToken)
      totalApiCalls += syncResult.totalApiCalls

      // Check Meta rate limit from last response
      const budget = checkSyncBudget(parseMetaRateLimitHeader(syncResult.rateLimitHeader))
      await trackAdAccountUsage(account.user_id, account.ad_account_id, syncResult.totalApiCalls, syncResult.rateLimitHeader)

      // Update last sync timestamp
      await supabase
        .from('ad_accounts')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', account.id)

      // Log sync
      await supabase.from('sync_logs').insert({
        user_id: account.user_id,
        ad_account_id: account.ad_account_id,
        sync_type: 'cron',
        status: syncResult.errors.length > 0 ? 'partial' : 'completed',
        api_calls_made: syncResult.totalApiCalls,
        rows_synced: syncResult.totalRowsSynced,
        error_message: syncResult.errors.length > 0 ? syncResult.errors.join('; ') : null,
        completed_at: new Date().toISOString(),
      })

      results.push({
        account_id: account.ad_account_id,
        account_name: account.ad_account_name,
        rows_synced: syncResult.totalRowsSynced,
        api_calls: syncResult.totalApiCalls,
        errors: syncResult.errors.length > 0 ? syncResult.errors : undefined,
        meta_rate_limit: budget.tier !== 'unknown' ? {
          tier: budget.tier,
          throttle_percentage: budget.throttlePercentage,
        } : null,
      })

      if (!budget.allowed) {
        break
      }
    } catch (err: any) {
      results.push({ account_id: account.ad_account_id, error: err.message })
    }
  }

  return NextResponse.json({
    success: true,
    sync_time: new Date().toISOString(),
    api_calls_made: totalApiCalls,
    accounts_synced: results.length,
    results,
  })
}
