import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getDecryptedToken } from '@/lib/meta-oauth'
import { requireProPlan } from '@/lib/subscription'
import {
  parseMetaRateLimitHeader,
  checkSyncBudget,
  getUserHourlyUsage,
  trackAdAccountUsage,
  INTERNAL_CALLS_LIMIT_PER_HOUR,
} from '@/lib/meta-rate-limit'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

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

  // Check internal safety limit BEFORE making any API calls
  const currentUsage = await getUserHourlyUsage(supabase, user.id)
  if (currentUsage >= INTERNAL_CALLS_LIMIT_PER_HOUR) {
    const resetAt = new Date(new Date().setHours(new Date().getHours() + 1, 0, 0, 0))
    return NextResponse.json({
      error: 'Internal rate limit exceeded',
      current_usage: currentUsage,
      max_calls: INTERNAL_CALLS_LIMIT_PER_HOUR,
      reset_at: resetAt.toISOString(),
    }, { status: 429 })
  }

  const body = await req.json()
  const { ad_account_id } = body

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
    const insightsRes = await fetch(
      `${GRAPH_API}/act_${ad_account_id}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach,actions,action_values&level=campaign&time_increment=1&time_range={'since':'2026-01-01','until':'2026-12-31'}&access_token=${accessToken}`
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

    // Get updated usage
    const updatedUsage = await getUserHourlyUsage(supabase, user.id)

    return NextResponse.json({
      success: true,
      account_id: ad_account_id,
      rows_synced: rowsSynced,
      synced_at: new Date().toISOString(),
      api_usage: {
        current: updatedUsage,
        max: INTERNAL_CALLS_LIMIT_PER_HOUR,
        remaining: INTERNAL_CALLS_LIMIT_PER_HOUR - updatedUsage,
        reset_at: new Date(new Date().setHours(new Date().getHours() + 1, 0, 0, 0)).toISOString(),
      },
      meta_rate_limit: metaRateLimitInfo ? {
        tier: metaRateLimitInfo.ads_api_access_tier,
        throttle_percentage: Math.max(metaRateLimitInfo.app_id_util_pct, metaRateLimitInfo.acc_id_util_pct),
        app_util_pct: metaRateLimitInfo.app_id_util_pct,
        account_util_pct: metaRateLimitInfo.acc_id_util_pct,
      } : null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
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

  const body = await req.json()
  const { ad_account_id, sync_enabled } = body

  if (!ad_account_id || sync_enabled === undefined) {
    return NextResponse.json({ error: 'ad_account_id and sync_enabled required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('ad_accounts')
    .update({ sync_enabled })
    .eq('ad_account_id', ad_account_id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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

  const usage = await getUserHourlyUsage(supabase, user.id)

  return NextResponse.json({
    current_usage: usage,
    max_calls: INTERNAL_CALLS_LIMIT_PER_HOUR,
    remaining: INTERNAL_CALLS_LIMIT_PER_HOUR - usage,
    reset_at: new Date(new Date().setHours(new Date().getHours() + 1, 0, 0, 0)).toISOString(),
  })
}
