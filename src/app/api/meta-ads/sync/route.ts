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
import { GRAPH_API } from '@/lib/meta-graph-api'

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
    // 1 API call: Fetch campaign-level insights
    const now = new Date()
    const since = new Date(now)
    since.setDate(now.getDate() - 90)
    const until = now.toISOString().slice(0, 10)
    const sinceStr = since.toISOString().slice(0, 10)

    const insightsRes = await fetch(
      `${GRAPH_API}/act_${ad_account_id}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach,actions,action_values&level=campaign&time_increment=1&time_range={'since':'${sinceStr}','until':'${until}'}&access_token=${accessToken}`
    )

    // Read Meta's rate limit headers from response
    const metaRateHeader = insightsRes.headers.get('x-business-use-case-usage')
      || insightsRes.headers.get('x-ad-account-usage')
      || insightsRes.headers.get('x-fb-ads-insights-throttle')
    const metaRateLimitInfo = parseMetaRateLimitHeader(metaRateHeader)

    // Check Meta's actual rate limit budget before proceeding
    const budget = checkSyncBudget(metaRateLimitInfo)
    if (!budget.allowed) {
      return NextResponse.json({
        error: 'Meta API rate limit exceeded',
        tier: budget.tier,
        throttle_percentage: budget.throttlePercentage,
        retry_after_seconds: budget.retryAfterSeconds,
        meta_limit: true,
      }, { status: 429 })
    }

    const insightsData = await insightsRes.json()

    if (insightsData.error) {
      return NextResponse.json({ error: insightsData.error.message }, { status: 500 })
    }

    // Record this API call (1 call made) + Meta's actual rate limit info
    await trackAdAccountUsage(user.id, ad_account_id, 1, metaRateHeader)

    // Upsert each row into ad_insights_cache
    let rowsSynced = 0
    if (insightsData.data && insightsData.data.length > 0) {
      for (const row of insightsData.data) {
        const leads = row.actions
          ? row.actions.find((a: any) => a.action_type === 'lead')?.value || 0
          : 0

        await supabase.from('ad_insights_cache').upsert(
          {
            ad_account_id: ad_account_id,
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

    // Get updated app-wide usage
    const { appUsage: updatedAppUsage } = await checkAppLevelLimit(supabase)

    return NextResponse.json({
      success: true,
      account_id: ad_account_id,
      rows_synced: rowsSynced,
      synced_at: new Date().toISOString(),
      api_usage: {
        app_current: updatedAppUsage,
        app_max: APP_LEVEL_CALLS_LIMIT_PER_HOUR,
        app_remaining: APP_LEVEL_CALLS_LIMIT_PER_HOUR - updatedAppUsage,
        reset_at: new Date(new Date().setHours(new Date().getHours() + 1, 0, 0, 0)).toISOString(),
      },
      meta_rate_limit: metaRateLimitInfo ? {
        tier: metaRateLimitInfo.ads_api_access_tier,
        throttle_percentage: Math.max(metaRateLimitInfo.app_id_util_pct, metaRateLimitInfo.acc_id_util_pct),
        app_util_pct: metaRateLimitInfo.app_id_util_pct,
        account_util_pct: metaRateLimitInfo.acc_id_util_pct,
      } : null,
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
