import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDecryptedToken } from '@/lib/meta-oauth'

const GRAPH_API = 'https://graph.facebook.com/v21.0'
const MAX_CALLS_PER_HOUR = 200

async function getUserUsage(supabase: any, userId: string) {
  const { data } = await supabase
    .from('meta_api_usage')
    .select('calls_made')
    .eq('user_id', userId)
    .gte('window_start', new Date(new Date().setMinutes(0, 0, 0)).toISOString())
  return (data || []).reduce((sum: number, row: any) => sum + row.calls_made, 0)
}

async function recordUserUsage(supabase: any, userId: string, calls: number) {
  await supabase.from('meta_api_usage').insert({
    user_id: userId,
    endpoint: 'cron-sync',
    calls_made: calls,
    window_start: new Date().toISOString(),
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('account_id') // Optional: sync single account

  // Validate cron secret
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

  // Build query - sync all enabled accounts or single account
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

  const results: any[] = []
  let totalApiCalls = 0
  const skippedUsers: string[] = []

  for (const account of adAccounts) {
    // Check rate limit for this user BEFORE making API calls
    const userUsage = await getUserUsage(supabase, account.user_id)
    if (userUsage >= MAX_CALLS_PER_HOUR) {
      skippedUsers.push(account.user_id)
      results.push({
        account_id: account.ad_account_id,
        error: 'Rate limit reached for this user',
        usage: userUsage,
      })
      continue
    }

    const accessToken = await getDecryptedToken(account.ad_account_id, account.user_id)
    if (!accessToken) {
      results.push({ account_id: account.ad_account_id, error: 'Token decryption failed' })
      continue
    }

    try {
      // 1 API call: Fetch campaign-level insights for the account
      const insightsRes = await fetch(
        `${GRAPH_API}/act_${account.ad_account_id}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach,actions,action_values&level=campaign&time_increment=1&time_range={'since':'2026-01-01','until':'2026-12-31'}&access_token=${accessToken}`
      )
      totalApiCalls++

      // Record this API call for the user
      await recordUserUsage(supabase, account.user_id, 1)

      const insightsData = await insightsRes.json()

      if (insightsData.error) {
        results.push({ account_id: account.ad_account_id, error: insightsData.error.message })
        continue
      }

      // Upsert each row into ad_insights_cache
      let rowsSynced = 0
      if (insightsData.data && insightsData.data.length > 0) {
        for (const row of insightsData.data) {
          const leads = row.actions
            ? row.actions.find((a: any) => a.action_type === 'lead')?.value || 0
            : 0

          await supabase.from('ad_insights_cache').upsert(
            {
              ad_account_id: account.ad_account_id,
              campaign_id: row.campaign_id,
              campaign_name: row.campaign_name,
              spend: parseFloat(row.spend || '0'),
              clicks: parseInt(row.clicks || '0'),
              impressions: parseInt(row.impressions || '0'),
              reach: parseInt(row.reach || '0'),
              leads: parseInt(leads),
              cpc: parseFloat(row.cpc || '0'),
              cpm: parseFloat(row.cpm || '0'),
              ctr: parseFloat(row.ctr || '0'),
              cost_per_lead: leads > 0 ? parseFloat(row.spend || '0') / parseInt(leads) : 0,
              date: row.date_start,
            },
            { onConflict: 'ad_account_id,campaign_id,date' }
          )
          rowsSynced++
        }
      }

      // Update last sync timestamp
      await supabase
        .from('ad_accounts')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', account.id)

      results.push({
        account_id: account.ad_account_id,
        account_name: account.ad_account_name,
        rows_synced: rowsSynced,
      })
    } catch (err: any) {
      results.push({ account_id: account.ad_account_id, error: err.message })
    }
  }

  return NextResponse.json({
    success: true,
    sync_time: new Date().toISOString(),
    api_calls_made: totalApiCalls,
    accounts_synced: results.length,
    skipped_rate_limit: skippedUsers.length,
    results,
  })
}
