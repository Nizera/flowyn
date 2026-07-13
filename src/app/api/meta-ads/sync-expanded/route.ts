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

function extractActions(actions: any[] | undefined, type: string): number {
  if (!actions) return 0
  const match = actions.find((a: any) => a.action_type === type)
  return match ? parseInt(match.value || '0', 10) : 0
}

function extractActionValues(values: any[] | undefined, type: string): number {
  if (!values) return 0
  const match = values.find((v: any) => v.action_type === type)
  return match ? parseFloat(match.value || '0') : 0
}

function parseBudget(value: string | undefined): number | null {
  if (!value) return null
  return parseInt(value, 10)
}

function getDateRange() {
  const now = new Date()
  const year = now.getFullYear()
  return JSON.stringify({ since: `${year}-01-01`, until: `${year}-12-31` })
}

// Helper to make API call with rate limit header extraction
async function metaApiCall(url: string): Promise<{ data: any; rateLimitHeader: string | null }> {
  const res = await fetch(url)
  const rateLimitHeader = res.headers.get('x-business-use-case-usage')
    || res.headers.get('x-ad-account-usage')
    || res.headers.get('x-fb-ads-insights-throttle')
  const data = await res.json()
  return { data, rateLimitHeader }
}

// Delay between API calls to pace requests (avoid burst throttling)
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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

  const body = await req.json()
  const { ad_account_id } = body

  if (!ad_account_id) {
    return NextResponse.json({ error: 'ad_account_id required' }, { status: 400 })
  }

  // Check internal safety limit
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
  let totalApiCalls = 0
  let totalRowsSynced = 0
  const errors: string[] = []
  const timeRange = getDateRange()
  let lastMetaRateLimit: any = null

  try {
    // 1. Sync Campaigns (1 API call)
    const { data: campaignsData, rateLimitHeader: campaignsRateHeader } = await metaApiCall(
      `${GRAPH_API}/act_${ad_account_id}/campaigns?fields=id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,bid_strategy,special_ad_categories,created_time,updated_time&limit=500&access_token=${accessToken}`
    )
    totalApiCalls++
    lastMetaRateLimit = parseMetaRateLimitHeader(campaignsRateHeader)

    // Check Meta's rate limit budget before continuing
    const budget = checkSyncBudget(lastMetaRateLimit)
    if (!budget.allowed) {
      return NextResponse.json({
        error: 'Meta API rate limit exceeded',
        tier: budget.tier,
        throttle_percentage: budget.throttlePercentage,
        retry_after_seconds: budget.retryAfterSeconds,
        api_calls_made: totalApiCalls,
        partial_sync: true,
      }, { status: 429 })
    }

    if (campaignsData.error) {
      errors.push(`Campaigns: ${campaignsData.error.message}`)
    } else if (campaignsData.data) {
      for (const c of campaignsData.data) {
        await supabase.from('campaigns').upsert({
          user_id: user.id,
          ad_account_id,
          campaign_id: c.id,
          name: c.name,
          status: c.status,
          effective_status: c.effective_status,
          objective: c.objective,
          buying_type: c.buying_type,
          daily_budget: parseBudget(c.daily_budget),
          lifetime_budget: parseBudget(c.lifetime_budget),
          bid_strategy: c.bid_strategy,
          special_ad_categories: c.special_ad_categories || [],
          created_time: c.created_time,
          updated_time: c.updated_time,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,ad_account_id,campaign_id' })
      }
      totalRowsSynced += campaignsData.data.length
    }

    // 2. Sync Ad Sets (1 API call) — pace with delay
    await delay(100)
    const { data: adsetsData, rateLimitHeader: adsetsRateHeader } = await metaApiCall(
      `${GRAPH_API}/act_${ad_account_id}/adsets?fields=id,name,campaign_id,status,effective_status,optimization_goal,billing_event,bid_strategy,bid_amount,budget_remaining,daily_budget,lifetime_budget,start_time,end_time,targeting&limit=500&access_token=${accessToken}`
    )
    totalApiCalls++
    lastMetaRateLimit = parseMetaRateLimitHeader(adsetsRateHeader)

    const adsetsBudget = checkSyncBudget(lastMetaRateLimit)
    if (!adsetsBudget.allowed) {
      return NextResponse.json({
        error: 'Meta API rate limit exceeded',
        tier: adsetsBudget.tier,
        throttle_percentage: adsetsBudget.throttlePercentage,
        retry_after_seconds: adsetsBudget.retryAfterSeconds,
        api_calls_made: totalApiCalls,
        rows_synced: totalRowsSynced,
        partial_sync: true,
      }, { status: 429 })
    }

    if (adsetsData.error) {
      errors.push(`AdSets: ${adsetsData.error.message}`)
    } else if (adsetsData.data) {
      for (const a of adsetsData.data) {
        await supabase.from('ad_sets').upsert({
          user_id: user.id,
          ad_account_id,
          campaign_id: a.campaign_id,
          ad_set_id: a.id,
          name: a.name,
          status: a.status,
          effective_status: a.effective_status,
          optimization_goal: a.optimization_goal,
          billing_event: a.billing_event,
          bid_strategy: a.bid_strategy,
          bid_amount: a.bid_amount,
          budget_remaining: parseBudget(a.budget_remaining),
          daily_budget: parseBudget(a.daily_budget),
          lifetime_budget: parseBudget(a.lifetime_budget),
          start_time: a.start_time,
          end_time: a.end_time,
          targeting: a.targeting || {},
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,ad_account_id,ad_set_id' })
      }
      totalRowsSynced += adsetsData.data.length
    }

    // 3. Sync Ads + Creatives (1 API call) — pace with delay
    await delay(100)
    const { data: adsData, rateLimitHeader: adsRateHeader } = await metaApiCall(
      `${GRAPH_API}/act_${ad_account_id}/ads?fields=id,name,adset_id,campaign_id,status,effective_status,creative{id,name,object_story_spec,effective_object_story_id,url_tags},tracking_specs,ad_review_feedback&limit=500&access_token=${accessToken}`
    )
    totalApiCalls++
    lastMetaRateLimit = parseMetaRateLimitHeader(adsRateHeader)

    const adsBudget = checkSyncBudget(lastMetaRateLimit)
    if (!adsBudget.allowed) {
      return NextResponse.json({
        error: 'Meta API rate limit exceeded',
        tier: adsBudget.tier,
        throttle_percentage: adsBudget.throttlePercentage,
        retry_after_seconds: adsBudget.retryAfterSeconds,
        api_calls_made: totalApiCalls,
        rows_synced: totalRowsSynced,
        partial_sync: true,
      }, { status: 429 })
    }

    if (adsData.error) {
      errors.push(`Ads: ${adsData.error.message}`)
    } else if (adsData.data) {
      for (const a of adsData.data) {
        const creative = a.creative || {}
        const storySpec = creative.object_story_spec || {}
        const linkData = storySpec.link_data || {}
        const photoData = storySpec.photo_data || {}
        const videoData = storySpec.video_data || {}

        await supabase.from('ads').upsert({
          user_id: user.id,
          ad_account_id,
          campaign_id: a.campaign_id,
          ad_set_id: a.adset_id,
          ad_id: a.id,
          name: a.name,
          status: a.status,
          effective_status: a.effective_status,
          creative_id: creative.id || null,
          title: linkData.name || linkData.caption || null,
          body: linkData.message || null,
          description: linkData.description || null,
          cta_type: linkData.call_to_action?.type || null,
          cta_text: linkData.call_to_action?.value?.text || null,
          image_url: photoData.url || linkData.picture || null,
          thumbnail_url: linkData.picture || null,
          video_id: videoData.id || null,
          website_url: linkData.link || null,
          trackings: a.tracking_specs || {},
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,ad_account_id,ad_id' })
      }
      totalRowsSynced += adsData.data.length
    }

    // 4. Campaign-level insights (1 API call) — pace with delay
    await delay(100)
    const { data: campaignInsightsData, rateLimitHeader: campaignInsightsRateHeader } = await metaApiCall(
      `${GRAPH_API}/act_${ad_account_id}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&level=campaign&time_increment=1&time_range=${timeRange}&access_token=${accessToken}`
    )
    totalApiCalls++
    lastMetaRateLimit = parseMetaRateLimitHeader(campaignInsightsRateHeader)

    const campaignInsightsBudget = checkSyncBudget(lastMetaRateLimit)
    if (!campaignInsightsBudget.allowed) {
      return NextResponse.json({
        error: 'Meta API rate limit exceeded',
        tier: campaignInsightsBudget.tier,
        throttle_percentage: campaignInsightsBudget.throttlePercentage,
        retry_after_seconds: campaignInsightsBudget.retryAfterSeconds,
        api_calls_made: totalApiCalls,
        rows_synced: totalRowsSynced,
        partial_sync: true,
      }, { status: 429 })
    }

    if (campaignInsightsData.error) {
      errors.push(`Campaign Insights: ${campaignInsightsData.error.message}`)
    } else if (campaignInsightsData.data) {
      for (const row of campaignInsightsData.data) {
        const purchases = extractActions(row.actions, 'purchase')
        const purchaseValue = extractActionValues(row.action_values, 'purchase')
        await supabase.from('ad_insights_cache').upsert({
          ad_account_id,
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          ad_set_id: '',
          ad_id: '',
          insight_level: 'campaign',
          spend: parseFloat(row.spend || '0'),
          clicks: parseInt(row.clicks || '0'),
          impressions: parseInt(row.impressions || '0'),
          reach: parseInt(row.reach || '0'),
          leads: extractActions(row.actions, 'lead'),
          cpc: parseFloat(row.cpc || '0'),
          cpm: parseFloat(row.cpm || '0'),
          ctr: parseFloat(row.ctr || '0'),
          cost_per_lead: extractActions(row.actions, 'lead') > 0 ? parseFloat(row.spend || '0') / extractActions(row.actions, 'lead') : 0,
          conversions: purchases,
          conversion_value: purchaseValue,
          purchase_count: purchases,
          purchase_value: purchaseValue,
          initiate_checkout: extractActions(row.actions, 'initiate_checkout'),
          add_to_cart: extractActions(row.actions, 'add_to_cart'),
          landing_page_views: extractActions(row.actions, 'landing_page_view'),
          unique_clicks: parseInt(row.clicks || '0'),
          frequency: parseFloat(row.frequency || '0'),
          quality_ranking: row.quality_ranking || null,
          engagement_rate_ranking: row.engagement_rate_ranking || null,
          conversion_rate_ranking: row.conversion_rate_ranking || null,
          date: row.date_start,
        }, { onConflict: 'ad_account_id,campaign_id,ad_set_id,ad_id,insight_level,date' })
      }
      totalRowsSynced += campaignInsightsData.data.length
    }

    // 5. Ad Set-level insights (1 API call) — pace with delay
    await delay(100)
    const { data: adsetInsightsData, rateLimitHeader: adsetInsightsRateHeader } = await metaApiCall(
      `${GRAPH_API}/act_${ad_account_id}/insights?fields=campaign_id,adset_id,adset_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values&level=adset&time_increment=1&time_range=${timeRange}&access_token=${accessToken}`
    )
    totalApiCalls++
    lastMetaRateLimit = parseMetaRateLimitHeader(adsetInsightsRateHeader)

    const adsetInsightsBudget = checkSyncBudget(lastMetaRateLimit)
    if (!adsetInsightsBudget.allowed) {
      return NextResponse.json({
        error: 'Meta API rate limit exceeded',
        tier: adsetInsightsBudget.tier,
        throttle_percentage: adsetInsightsBudget.throttlePercentage,
        retry_after_seconds: adsetInsightsBudget.retryAfterSeconds,
        api_calls_made: totalApiCalls,
        rows_synced: totalRowsSynced,
        partial_sync: true,
      }, { status: 429 })
    }

    if (adsetInsightsData.error) {
      errors.push(`AdSet Insights: ${adsetInsightsData.error.message}`)
    } else if (adsetInsightsData.data) {
      for (const row of adsetInsightsData.data) {
        const purchases = extractActions(row.actions, 'purchase')
        const purchaseValue = extractActionValues(row.action_values, 'purchase')
        await supabase.from('ad_insights_cache').upsert({
          ad_account_id,
          campaign_id: row.campaign_id,
          campaign_name: row.adset_name,
          ad_set_id: row.adset_id,
          ad_id: '',
          insight_level: 'adset',
          spend: parseFloat(row.spend || '0'),
          clicks: parseInt(row.clicks || '0'),
          impressions: parseInt(row.impressions || '0'),
          reach: parseInt(row.reach || '0'),
          leads: extractActions(row.actions, 'lead'),
          cpc: parseFloat(row.cpc || '0'),
          cpm: parseFloat(row.cpm || '0'),
          ctr: parseFloat(row.ctr || '0'),
          cost_per_lead: extractActions(row.actions, 'lead') > 0 ? parseFloat(row.spend || '0') / extractActions(row.actions, 'lead') : 0,
          conversions: purchases,
          conversion_value: purchaseValue,
          purchase_count: purchases,
          purchase_value: purchaseValue,
          initiate_checkout: extractActions(row.actions, 'initiate_checkout'),
          add_to_cart: extractActions(row.actions, 'add_to_cart'),
          landing_page_views: extractActions(row.actions, 'landing_page_view'),
          unique_clicks: parseInt(row.clicks || '0'),
          frequency: parseFloat(row.frequency || '0'),
          date: row.date_start,
        }, { onConflict: 'ad_account_id,campaign_id,ad_set_id,ad_id,insight_level,date' })
      }
      totalRowsSynced += adsetInsightsData.data.length
    }

    // 6. Ad-level insights (1 API call) — pace with delay
    await delay(100)
    const { data: adInsightsData, rateLimitHeader: adInsightsRateHeader } = await metaApiCall(
      `${GRAPH_API}/act_${ad_account_id}/insights?fields=campaign_id,adset_id,ad_id,ad_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values&level=ad&time_increment=1&time_range=${timeRange}&access_token=${accessToken}`
    )
    totalApiCalls++
    lastMetaRateLimit = parseMetaRateLimitHeader(adInsightsRateHeader)

    if (adInsightsData.error) {
      errors.push(`Ad Insights: ${adInsightsData.error.message}`)
    } else if (adInsightsData.data) {
      for (const row of adInsightsData.data) {
        const purchases = extractActions(row.actions, 'purchase')
        const purchaseValue = extractActionValues(row.action_values, 'purchase')
        await supabase.from('ad_insights_cache').upsert({
          ad_account_id,
          campaign_id: row.campaign_id,
          campaign_name: row.ad_name,
          ad_set_id: row.adset_id,
          ad_id: row.ad_id,
          insight_level: 'ad',
          spend: parseFloat(row.spend || '0'),
          clicks: parseInt(row.clicks || '0'),
          impressions: parseInt(row.impressions || '0'),
          reach: parseInt(row.reach || '0'),
          leads: extractActions(row.actions, 'lead'),
          cpc: parseFloat(row.cpc || '0'),
          cpm: parseFloat(row.cpm || '0'),
          ctr: parseFloat(row.ctr || '0'),
          cost_per_lead: extractActions(row.actions, 'lead') > 0 ? parseFloat(row.spend || '0') / extractActions(row.actions, 'lead') : 0,
          conversions: purchases,
          conversion_value: purchaseValue,
          purchase_count: purchases,
          purchase_value: purchaseValue,
          initiate_checkout: extractActions(row.actions, 'initiate_checkout'),
          add_to_cart: extractActions(row.actions, 'add_to_cart'),
          landing_page_views: extractActions(row.actions, 'landing_page_view'),
          unique_clicks: parseInt(row.clicks || '0'),
          frequency: parseFloat(row.frequency || '0'),
          date: row.date_start,
        }, { onConflict: 'ad_account_id,campaign_id,ad_set_id,ad_id,insight_level,date' })
      }
      totalRowsSynced += adInsightsData.data.length
    }

    // Update last sync timestamp
    await supabase
      .from('ad_accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', account.id)

    // Record usage with Meta's actual rate limit info
    await trackAdAccountUsage(user.id, ad_account_id, totalApiCalls, lastMetaRateLimit ? JSON.stringify(lastMetaRateLimit) : null)

    // Log sync
    await supabase.from('sync_logs').insert({
      user_id: user.id,
      ad_account_id,
      sync_type: 'full',
      status: errors.length > 0 ? 'partial' : 'completed',
      api_calls_made: totalApiCalls,
      rows_synced: totalRowsSynced,
      error_message: errors.length > 0 ? errors.join('; ') : null,
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    })

    const updatedUsage = await getUserHourlyUsage(supabase, user.id)

    return NextResponse.json({
      success: true,
      account_id: ad_account_id,
      rows_synced: totalRowsSynced,
      api_calls_made: totalApiCalls,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: Date.now() - startTime,
      synced_at: new Date().toISOString(),
      api_usage: {
        current: updatedUsage,
        max: INTERNAL_CALLS_LIMIT_PER_HOUR,
        remaining: INTERNAL_CALLS_LIMIT_PER_HOUR - updatedUsage,
        reset_at: new Date(new Date().setHours(new Date().getHours() + 1, 0, 0, 0)).toISOString(),
      },
      meta_rate_limit: lastMetaRateLimit ? {
        tier: lastMetaRateLimit.ads_api_access_tier,
        throttle_percentage: Math.max(lastMetaRateLimit.app_id_util_pct, lastMetaRateLimit.acc_id_util_pct),
        app_util_pct: lastMetaRateLimit.app_id_util_pct,
        account_util_pct: lastMetaRateLimit.acc_id_util_pct,
      } : null,
    })
  } catch (err: any) {
    // Log failed sync
    await supabase.from('sync_logs').insert({
      user_id: user.id,
      ad_account_id,
      sync_type: 'full',
      status: 'failed',
      api_calls_made: totalApiCalls,
      rows_synced: totalRowsSynced,
      error_message: err.message?.slice(0, 500),
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    })

    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
