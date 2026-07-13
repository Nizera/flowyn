import { createAdminClient } from '@/utils/supabase/admin'

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

type SyncResult = {
  totalApiCalls: number
  totalRowsSynced: number
  errors: string[]
  rateLimitHeader: string | null
}

export async function syncAccountFull(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  adAccountId: string,
  accessToken: string
): Promise<SyncResult> {
  let totalApiCalls = 0
  let totalRowsSynced = 0
  const errors: string[] = []
  let rateLimitHeader: string | null = null
  const timeRange = getDateRange()

  function metaApiCall(url: string): Promise<{ data: any; header: string | null }> {
    return fetch(url).then(async res => {
      const header = res.headers.get('x-business-use-case-usage')
        || res.headers.get('x-ad-account-usage')
        || res.headers.get('x-fb-ads-insights-throttle')
      const data = await res.json()
      return { data, header }
    })
  }

  function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // 1. Sync Campaigns
  const { data: campaignsData, header: ch } = await metaApiCall(
    `${GRAPH_API}/act_${adAccountId}/campaigns?fields=id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,bid_strategy,special_ad_categories,created_time,updated_time&limit=500&access_token=${accessToken}`
  )
  totalApiCalls++
  rateLimitHeader = ch

  if (campaignsData.error) {
    errors.push(`Campaigns: ${campaignsData.error.message}`)
  } else if (campaignsData.data) {
    for (const c of campaignsData.data) {
      await supabase.from('campaigns').upsert({
        user_id: userId,
        ad_account_id: adAccountId,
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

  // 2. Sync Ad Sets
  await delay(100)
  const { data: adsetsData, header: ah } = await metaApiCall(
    `${GRAPH_API}/act_${adAccountId}/adsets?fields=id,name,campaign_id,status,effective_status,optimization_goal,billing_event,bid_strategy,bid_amount,budget_remaining,daily_budget,lifetime_budget,start_time,end_time,targeting&limit=500&access_token=${accessToken}`
  )
  totalApiCalls++
  rateLimitHeader = ah

  if (adsetsData.error) {
    errors.push(`AdSets: ${adsetsData.error.message}`)
  } else if (adsetsData.data) {
    for (const a of adsetsData.data) {
      await supabase.from('ad_sets').upsert({
        user_id: userId,
        ad_account_id: adAccountId,
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

  // 3. Sync Ads + Creatives
  await delay(100)
  const { data: adsData, header: adh } = await metaApiCall(
    `${GRAPH_API}/act_${adAccountId}/ads?fields=id,name,adset_id,campaign_id,status,effective_status,creative{id,name,object_story_spec,effective_object_story_id,url_tags},tracking_specs,ad_review_feedback&limit=500&access_token=${accessToken}`
  )
  totalApiCalls++
  rateLimitHeader = adh

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
        user_id: userId,
        ad_account_id: adAccountId,
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

  // Helper to upsert insights
  async function upsertInsights(rows: any[], level: string) {
    for (const row of rows) {
      const purchases = extractActions(row.actions, 'purchase')
      const purchaseValue = extractActionValues(row.action_values, 'purchase')
      const leadCount = extractActions(row.actions, 'lead')
      await supabase.from('ad_insights_cache').upsert({
        ad_account_id: adAccountId,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name || row.adset_name || row.ad_name || '',
        ad_set_id: row.adset_id || '',
        ad_id: row.ad_id || '',
        insight_level: level,
        spend: parseFloat(row.spend || '0'),
        clicks: parseInt(row.clicks || '0'),
        impressions: parseInt(row.impressions || '0'),
        reach: parseInt(row.reach || '0'),
        leads: leadCount,
        cpc: parseFloat(row.cpc || '0'),
        cpm: parseFloat(row.cpm || '0'),
        ctr: parseFloat(row.ctr || '0'),
        cost_per_lead: leadCount > 0 ? parseFloat(row.spend || '0') / leadCount : 0,
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
      totalRowsSynced++
    }
  }

  // 4. Campaign-level insights
  await delay(100)
  const { data: campaignInsights, header: cih } = await metaApiCall(
    `${GRAPH_API}/act_${adAccountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&level=campaign&time_increment=1&time_range=${timeRange}&access_token=${accessToken}`
  )
  totalApiCalls++
  rateLimitHeader = cih

  if (campaignInsights.error) {
    errors.push(`Campaign Insights: ${campaignInsights.error.message}`)
  } else if (campaignInsights.data) {
    await upsertInsights(campaignInsights.data, 'campaign')
  }

  // 5. Ad Set-level insights
  await delay(100)
  const { data: adsetInsights, header: aih } = await metaApiCall(
    `${GRAPH_API}/act_${adAccountId}/insights?fields=campaign_id,adset_id,adset_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values&level=adset&time_increment=1&time_range=${timeRange}&access_token=${accessToken}`
  )
  totalApiCalls++
  rateLimitHeader = aih

  if (adsetInsights.error) {
    errors.push(`AdSet Insights: ${adsetInsights.error.message}`)
  } else if (adsetInsights.data) {
    await upsertInsights(adsetInsights.data, 'adset')
  }

  // 6. Ad-level insights
  await delay(100)
  const { data: adInsights, header: adi } = await metaApiCall(
    `${GRAPH_API}/act_${adAccountId}/insights?fields=campaign_id,adset_id,ad_id,ad_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values&level=ad&time_increment=1&time_range=${timeRange}&access_token=${accessToken}`
  )
  totalApiCalls++
  rateLimitHeader = adi

  if (adInsights.error) {
    errors.push(`Ad Insights: ${adInsights.error.message}`)
  } else if (adInsights.data) {
    await upsertInsights(adInsights.data, 'ad')
  }

  return { totalApiCalls, totalRowsSynced, errors, rateLimitHeader }
}
