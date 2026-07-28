import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { requireProPlan } from '@/lib/subscription'
import { getDecryptedToken } from '@/lib/meta-oauth'
import { GRAPH_API } from '@/lib/meta-graph-api'

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

  try {
    const { searchParams } = new URL(req.url)
    const adAccountId = searchParams.get('ad_account_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    if (!adAccountId) {
      return NextResponse.json({ error: 'ad_account_id required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify user owns this account
    const { data: account } = await admin
      .from('ad_accounts')
      .select('id')
      .eq('ad_account_id', adAccountId)
      .eq('user_id', user.id)
      .single()

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Fetch campaigns from local DB
    const { data: campaigns } = await admin
      .from('campaigns')
      .select('*')
      .eq('ad_account_id', adAccountId)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    // Filter out placeholder records from response (DO NOT delete from DB on GET)
    const realCampaigns = (campaigns || []).filter(c => c.name && c.name !== c.campaign_id)

    // If local DB has campaigns, use them
    if (realCampaigns.length > 0) {
      const since = dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const until = dateTo || new Date().toISOString().slice(0, 10)

      const { data: campaignInsights } = await admin
        .from('ad_insights_cache')
        .select('*')
        .eq('ad_account_id', adAccountId)
        .eq('insight_level', 'campaign')
        .gte('date', since)
        .lte('date', until)

      const { data: adsetInsights } = await admin
        .from('ad_insights_cache')
        .select('*')
        .eq('ad_account_id', adAccountId)
        .eq('insight_level', 'adset')
        .gte('date', since)
        .lte('date', until)

      const { data: adInsights } = await admin
        .from('ad_insights_cache')
        .select('*')
        .eq('ad_account_id', adAccountId)
        .eq('insight_level', 'ad')
        .gte('date', since)
        .lte('date', until)

      function reduceInsights(rows: any[]) {
        const totals = rows.reduce((acc: any, curr: any) => ({
          spend: acc.spend + (parseFloat(curr.spend) || 0),
          impressions: acc.impressions + (parseInt(curr.impressions) || 0),
          clicks: acc.clicks + (parseInt(curr.clicks) || 0),
          reach: acc.reach + (parseInt(curr.reach) || 0),
          conversions: acc.conversions + (parseInt(curr.conversions) || 0),
          conversion_value: acc.conversion_value + (parseFloat(curr.conversion_value) || 0),
          landing_page_views: acc.landing_page_views + (parseInt(curr.landing_page_views) || 0),
          initiate_checkout: acc.initiate_checkout + (parseInt(curr.initiate_checkout) || 0),
        }), {
          spend: 0, impressions: 0, clicks: 0, reach: 0,
          conversions: 0, conversion_value: 0,
          landing_page_views: 0, initiate_checkout: 0,
        })

        return {
          ...totals,
          cpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
          cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : null,
          ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null,
          cpv: totals.landing_page_views > 0 ? totals.spend / totals.landing_page_views : null,
          cpi: totals.initiate_checkout > 0 ? totals.spend / totals.initiate_checkout : null,
          cpa: totals.conversions > 0 ? totals.spend / totals.conversions : null,
          roas: totals.spend > 0 ? totals.conversion_value / totals.spend : null,
        }
      }

      const { data: adSets } = await admin
        .from('ad_sets')
        .select('*')
        .eq('ad_account_id', adAccountId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      const { data: ads } = await admin
        .from('ads')
        .select('*')
        .eq('ad_account_id', adAccountId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      const enrichedCampaigns = realCampaigns.map(c => ({
        ...c,
        insights: reduceInsights((campaignInsights || []).filter(i => i.campaign_id === c.campaign_id))
      }))

      const enrichedAdSets = (adSets || []).map(a => ({
        ...a,
        insights: reduceInsights((adsetInsights || []).filter(i => i.ad_set_id === a.ad_set_id))
      }))

      const enrichedAds = (ads || []).map(a => ({
        ...a,
        insights: reduceInsights((adInsights || []).filter(i => i.ad_id === a.ad_id))
      }))

      return NextResponse.json({
        campaigns: enrichedCampaigns,
        ad_sets: enrichedAdSets,
        ads: enrichedAds,
      })
    }

    // Fallback: local DB empty — fetch from Meta API
    const accessToken = await getDecryptedToken(adAccountId, user.id)
    if (!accessToken) {
      return NextResponse.json({ campaigns: [], ad_sets: [], ads: [] })
    }

    const now = new Date()
    const sinceDate = dateFrom ? new Date(dateFrom) : new Date(now.getTime() - 30 * 86400000)
    const sinceStr = sinceDate.toISOString().slice(0, 10)
    const untilStr = dateTo || now.toISOString().slice(0, 10)
    const timeRange = `{'since':'${sinceStr}','until':'${untilStr}'}`

    async function metaApiCall(url: string) {
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return { data: { error: { message: err?.error?.message || `HTTP ${res.status}` } } }
      }
      return { data: await res.json() }
    }

    // 1. Campaigns
    const { data: campaignsData } = await metaApiCall(
      `${GRAPH_API}/act_${adAccountId}/campaigns?fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget,bid_strategy,created_time,updated_time&limit=500&access_token=${accessToken}`
    )

    if (campaignsData.error) {
      return NextResponse.json({ campaigns: [], ad_sets: [], ads: [], error: campaignsData.error.message })
    }

    const metaCampaigns = campaignsData.data || []

    // 2. Campaign insights
    const { data: campaignInsightsData } = await metaApiCall(
      `${GRAPH_API}/act_${adAccountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&level=campaign&time_increment=1&time_range=${timeRange}&limit=500&access_token=${accessToken}`
    )

    // 3. Ad Sets
    const { data: adsetsData } = await metaApiCall(
      `${GRAPH_API}/act_${adAccountId}/adsets?fields=id,name,campaign_id,status,effective_status,optimization_goal,billing_event,daily_budget,lifetime_budget,start_time,end_time&limit=500&access_token=${accessToken}`
    )

    // 4. Ad Set insights
    const { data: adsetInsightsData } = await metaApiCall(
      `${GRAPH_API}/act_${adAccountId}/insights?fields=campaign_id,adset_id,adset_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values&level=adset&time_increment=1&time_range=${timeRange}&limit=500&access_token=${accessToken}`
    )

    // 5. Ads
    const { data: adsData } = await metaApiCall(
      `${GRAPH_API}/act_${adAccountId}/ads?fields=id,name,adset_id,campaign_id,status,effective_status,creative{id,name,object_story_spec}&limit=500&access_token=${accessToken}`
    )

    // 6. Ad insights
    const { data: adInsightsData } = await metaApiCall(
      `${GRAPH_API}/act_${adAccountId}/insights?fields=campaign_id,adset_id,ad_id,ad_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values&level=ad&time_increment=1&time_range=${timeRange}&limit=500&access_token=${accessToken}`
    )

    // 7. If campaign-level insights have 0 spend, try ad-level without time_increment (aggregated)
    let effectiveCampaignInsights = campaignInsightsData?.data
    const campTotalSpend = (effectiveCampaignInsights || []).reduce((s: number, r: any) => s + (parseFloat(r.spend || '0') || 0), 0)
    if (campTotalSpend === 0 && (effectiveCampaignInsights || []).length > 0) {
      const { data: aggAdData } = await metaApiCall(
        `${GRAPH_API}/act_${adAccountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach,actions,action_values&level=ad&time_range=${timeRange}&limit=500&access_token=${accessToken}`
      )
      if (aggAdData?.data && aggAdData.data.length > 0) {
        const aggTotalSpend = aggAdData.data.reduce((s: number, r: any) => s + (parseFloat(r.spend || '0') || 0), 0)
        if (aggTotalSpend > 0) {
          // Aggregate ad-level into campaign-level rows
          const aggMap: Record<string, any> = {}
          for (const row of aggAdData.data) {
            const cid = row.campaign_id
            if (!aggMap[cid]) {
              aggMap[cid] = {
                campaign_id: cid,
                campaign_name: row.campaign_name || '',
                impressions: 0, clicks: 0, spend: 0, reach: 0,
                actions: [] as any[], action_values: [] as any[],
              }
            }
            aggMap[cid].impressions += parseInt(row.impressions || '0')
            aggMap[cid].clicks += parseInt(row.clicks || '0')
            aggMap[cid].spend += parseFloat(row.spend || '0')
            aggMap[cid].reach += parseInt(row.reach || '0')
            // Merge actions by action_type (sum values) instead of naive push
            if (row.actions) {
              for (const action of row.actions) {
                const existing = aggMap[cid].actions.find((a: any) => a.action_type === action.action_type)
                if (existing) {
                  existing.value = String(parseInt(existing.value || '0') + parseInt(action.value || '0'))
                } else {
                  aggMap[cid].actions.push({ ...action })
                }
              }
            }
            if (row.action_values) {
              for (const val of row.action_values) {
                const existing = aggMap[cid].action_values.find((v: any) => v.action_type === val.action_type)
                if (existing) {
                  existing.value = String(parseFloat(existing.value || '0') + parseFloat(val.value || '0'))
                } else {
                  aggMap[cid].action_values.push({ ...val })
                }
              }
            }
          }
          effectiveCampaignInsights = Object.values(aggMap)
        }
      }
    }

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

    function mapInsight(row: any) {
      const purchases = extractActions(row.actions, 'purchase')
      const purchaseValue = extractActionValues(row.action_values, 'purchase')
      return {
        spend: parseFloat(row.spend || '0'),
        impressions: parseInt(row.impressions || '0'),
        clicks: parseInt(row.clicks || '0'),
        reach: parseInt(row.reach || '0'),
        conversions: purchases,
        conversion_value: purchaseValue,
        landing_page_views: extractActions(row.actions, 'landing_page_view'),
        initiate_checkout: extractActions(row.actions, 'initiate_checkout'),
        cpc: parseFloat(row.cpc || '0'),
        cpm: parseFloat(row.cpm || '0'),
        ctr: parseFloat(row.ctr || '0'),
        cpv: null as number | null,
        cpi: null as number | null,
        cpa: purchases > 0 ? parseFloat(row.spend || '0') / purchases : null,
        roas: purchaseValue > 0 && parseFloat(row.spend || '0') > 0 ? purchaseValue / parseFloat(row.spend || '0') : null,
      }
    }

    // Aggregate insights by campaign/adset/ad
    function buildInsightMap(data: any[] | undefined) {
      const map: Record<string, any> = {}
      for (const row of data || []) {
        const id = row.campaign_id || row.adset_id || row.ad_id
        if (!id) continue
        if (!map[id]) map[id] = []
        map[id].push(row)
      }
      return map
    }

    function reduceAggregated(rows: any[]) {
      if (rows.length === 0) {
        return { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0, landing_page_views: 0, initiate_checkout: 0, cpc: null, cpm: null, ctr: null, cpv: null, cpi: null, cpa: null, roas: null }
      }
      const mapped = rows.map(mapInsight)
      const totals = mapped.reduce((acc, curr) => ({
        spend: acc.spend + curr.spend,
        impressions: acc.impressions + curr.impressions,
        clicks: acc.clicks + curr.clicks,
        reach: acc.reach + curr.reach,
        conversions: acc.conversions + curr.conversions,
        conversion_value: acc.conversion_value + curr.conversion_value,
        landing_page_views: acc.landing_page_views + curr.landing_page_views,
        initiate_checkout: acc.initiate_checkout + curr.initiate_checkout,
      }), { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0, landing_page_views: 0, initiate_checkout: 0 })

      return {
        ...totals,
        cpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
        cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : null,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null,
        cpv: totals.landing_page_views > 0 ? totals.spend / totals.landing_page_views : null,
        cpi: totals.initiate_checkout > 0 ? totals.spend / totals.initiate_checkout : null,
        cpa: totals.conversions > 0 ? totals.spend / totals.conversions : null,
        roas: totals.spend > 0 ? totals.conversion_value / totals.spend : null,
      }
    }

    const campaignInsightMap = buildInsightMap(effectiveCampaignInsights)
    const adsetInsightMap = buildInsightMap(adsetInsightsData?.data)
    const adInsightMap = buildInsightMap(adInsightsData?.data)

    const enrichedCampaigns = metaCampaigns.map((c: any) => ({
      campaign_id: c.id,
      name: c.name,
      status: c.status,
      effective_status: c.effective_status || c.status,
      objective: c.objective || null,
      daily_budget: c.daily_budget || null,
      lifetime_budget: c.lifetime_budget || null,
      insights: reduceAggregated(campaignInsightMap[c.id] || []),
    }))

    const metaAdSets = adsetsData?.data || []
    const enrichedAdSets = metaAdSets.map((a: any) => ({
      ad_set_id: a.id,
      name: a.name,
      campaign_id: a.campaign_id,
      status: a.status,
      effective_status: a.effective_status || a.status,
      daily_budget: a.daily_budget || null,
      lifetime_budget: a.lifetime_budget || null,
      insights: reduceAggregated(adsetInsightMap[a.id] || []),
    }))

    const metaAds = adsData?.data || []
    const enrichedAds = metaAds.map((a: any) => ({
      ad_id: a.id,
      name: a.name,
      campaign_id: a.campaign_id,
      ad_set_id: a.adset_id,
      status: a.status,
      effective_status: a.effective_status || a.status,
      insights: reduceAggregated(adInsightMap[a.id] || []),
    }))

    return NextResponse.json({
      campaigns: enrichedCampaigns,
      ad_sets: enrichedAdSets,
      ads: enrichedAds,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
