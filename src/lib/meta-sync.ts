import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'
import { GRAPH_API } from '@/lib/meta-graph-api'

function extractActions(actions: any[] | undefined, type: string): number {
  if (!actions) return 0
  const match = actions.find((a: any) => a.action_type === type)
  return match ? (parseInt(match.value || '0', 10) || 0) : 0
}

function extractActionValues(values: any[] | undefined, type: string): number {
  if (!values) return 0
  const match = values.find((v: any) => v.action_type === type)
  return match ? (parseFloat(match.value || '0') || 0) : 0
}

function parseBudget(value: string | undefined): number | null {
  if (!value) return null
  return parseInt(value, 10)
}

function getDateRange(sinceDate?: string) {
  const now = new Date()
  const since = sinceDate ? new Date(sinceDate) : new Date(now)
  if (!sinceDate) since.setDate(since.getDate() - 90)
  return JSON.stringify({
    since: since.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }),
    until: now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }),
  })
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
  accessToken: string,
  syncFromDate?: string
): Promise<SyncResult> {
  let totalApiCalls = 0
  let totalRowsSynced = 0
  const errors: string[] = []
  let rateLimitHeader: string | null = null
  const timeRange = getDateRange(syncFromDate)
  const timeRangeObj = JSON.parse(timeRange)

  // CORREÇÃO W9 (auditoria tracking): advisory lock defensivo via sync_lock_until.
  // Janela de lock: 5 min (sync típico leva <2 min).
  // Atomic: update WHERE lock is null or expired, then check rows affected.
  const lockUntil = new Date(Date.now() + 5 * 60_000).toISOString()
  const now = new Date().toISOString()
  const { data: lockData, error: lockError } = await supabase
    .from('ad_accounts')
    .update({ sync_lock_until: lockUntil })
    .eq('ad_account_id', adAccountId)
    .eq('user_id', userId)
    .or(`sync_lock_until.is.null,sync_lock_until.lt.${now}`)
    .select('id')

  if (lockError) {
    if (!/column .* does not exist|Could not find the column/i.test(lockError.message)) {
      console.warn('[Meta Sync] Lock set failed (continuing):', lockError.message)
    } else {
      console.warn('[Meta Sync] sync_lock_until column not applied yet — running without advisory lock.')
    }
  }

  // If lock update succeeded but no rows were affected, another sync holds the lock
  if (!lockError && (!lockData || lockData.length === 0)) {
    console.warn(`[Meta Sync] Lock held by another process for ${adAccountId} — skipping`)
    return {
      totalApiCalls: 0,
      totalRowsSynced: 0,
      errors: ['Sync já em andamento para esta conta (advisory lock ativo). Tente novamente em alguns minutos.'],
      rateLimitHeader: null,
    }
  }

  try {

  function metaApiCall(url: string): Promise<{ data: any; header: string | null }> {
    return fetch(url).then(async res => {
      const header = res.headers.get('x-business-use-case-usage')
        || res.headers.get('x-ad-account-usage')
        || res.headers.get('x-fb-ads-insights-throttle')
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const msg = errBody?.error?.message || `HTTP ${res.status}`
        return { data: { error: { message: msg } }, header }
      }
      const data = await res.json()
      return { data, header }
    }).catch(err => {
      return { data: { error: { message: err?.message || 'Network error' } }, header: null }
    })
  }

  async function fetchAllPages(url: string): Promise<{ allData: any[]; header: string | null }> {
    const allData: any[] = []
    let currentUrl: string | null = url
    let lastHeader: string | null = null
    let safety = 0

    while (currentUrl && safety < 100) {
      safety++
      const { data, header } = await metaApiCall(currentUrl)
      lastHeader = header

      if (data.error) {
        errors.push(`Pagination: ${data.error.message}`)
        break
      }

      if (data.data) {
        allData.push(...data.data)
      }

      currentUrl = data.paging?.next || null

      if (currentUrl) {
        await delay(50)
      }
    }

    return { allData, header: lastHeader }
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
    console.error('[Meta Sync] Campaigns API error:', campaignsData.error.message)
  } else if (campaignsData.data) {
    console.log(`[Meta Sync] Campaigns returned from Meta API: ${campaignsData.data.length}`)
    console.log('[Meta Sync] Campaign names:', campaignsData.data.map((c: any) => `${c.name} (${c.id}) [${c.effective_status}]`))
    const now = new Date().toISOString()
    const campaignRows = campaignsData.data.map((c: any) => ({
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
      synced_at: now,
      updated_at: now,
    }))
    const { error: upsertErr } = await supabase
      .from('campaigns')
      .upsert(campaignRows, { onConflict: 'user_id,ad_account_id,campaign_id' })
    if (upsertErr) {
      console.error('[Meta Sync] Campaigns batch upsert error:', upsertErr.message)
    }
    totalRowsSynced += campaignsData.data.length
    console.log(`[Meta Sync] Synced ${campaignsData.data.length} campaigns to local DB`)
  }

  // Fetch excluded campaign IDs (sync_enabled = false)
  const { data: excludedRows } = await supabase
    .from('campaigns')
    .select('campaign_id')
    .eq('user_id', userId)
    .eq('ad_account_id', adAccountId)
    .eq('sync_enabled', false)

  const excludedCampaignIds = new Set((excludedRows || []).map(r => r.campaign_id))

  // Delete insights for excluded campaigns
  if (excludedCampaignIds.size > 0) {
    const excludedArr = Array.from(excludedCampaignIds)
    await supabase
      .from('ad_insights_cache')
      .delete()
      .eq('ad_account_id', adAccountId)
      .in('campaign_id', excludedArr)
    await supabase
      .from('campaign_insights')
      .delete()
      .eq('ad_account_id', adAccountId)
      .in('campaign_id', excludedArr)
  }

  // 2. Sync Ad Sets
  const { data: adsetsData, header: ah } = await metaApiCall(
    `${GRAPH_API}/act_${adAccountId}/adsets?fields=id,name,campaign_id,status,effective_status,optimization_goal,billing_event,bid_strategy,bid_amount,budget_remaining,daily_budget,lifetime_budget,start_time,end_time,targeting&limit=500&access_token=${accessToken}`
  )
  totalApiCalls++
  rateLimitHeader = ah

  if (adsetsData.error) {
    errors.push(`AdSets: ${adsetsData.error.message}`)
  } else if (adsetsData.data) {
    const adsetNow = new Date().toISOString()
    const adsetRows = adsetsData.data.map((a: any) => ({
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
      synced_at: adsetNow,
      updated_at: adsetNow,
    }))
    const { error: adsetUpsertErr } = await supabase
      .from('ad_sets')
      .upsert(adsetRows, { onConflict: 'user_id,ad_account_id,ad_set_id' })
    if (adsetUpsertErr) {
      console.error('[Meta Sync] AdSets batch upsert error:', adsetUpsertErr.message)
    }
    totalRowsSynced += adsetsData.data.length
  }

  // 3. Sync Ads + Creatives
  const { data: adsData, header: adh } = await metaApiCall(
    `${GRAPH_API}/act_${adAccountId}/ads?fields=id,name,adset_id,campaign_id,status,effective_status,creative{id,name,object_story_spec,effective_object_story_id,url_tags},tracking_specs,ad_review_feedback&limit=500&access_token=${accessToken}`
  )
  totalApiCalls++
  rateLimitHeader = adh

  if (adsData.error) {
    errors.push(`Ads: ${adsData.error.message}`)
  } else if (adsData.data) {
    const adNow = new Date().toISOString()
    const adRows = adsData.data.map((a: any) => {
      const creative = a.creative || {}
      const storySpec = creative.object_story_spec || {}
      const linkData = storySpec.link_data || {}
      const photoData = storySpec.photo_data || {}
      const videoData = storySpec.video_data || {}

      return {
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
        synced_at: adNow,
        updated_at: adNow,
      }
    })
    const { error: adUpsertErr } = await supabase
      .from('ads')
      .upsert(adRows, { onConflict: 'user_id,ad_account_id,ad_id' })
    if (adUpsertErr) {
      console.error('[Meta Sync] Ads batch upsert error:', adUpsertErr.message)
    }
    totalRowsSynced += adsData.data.length
  }

  // Helper to upsert insights in batches
  async function upsertInsights(rows: any[], level: string) {
    const BATCH_SIZE = 500

    function mapRow(row: any) {
      const purchases = extractActions(row.actions, 'purchase')
      const purchaseValue = extractActionValues(row.action_values, 'purchase')
      const leadCount = extractActions(row.actions, 'lead')
      return {
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
      }
    }

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).map(mapRow)
        .filter(row =>
          !excludedCampaignIds.has(row.campaign_id)
          && (row.spend > 0
          || row.impressions > 0
          || row.clicks > 0
          || row.conversions > 0
          || row.landing_page_views > 0
          || row.initiate_checkout > 0
          || row.add_to_cart > 0)
        )

      if (batch.length === 0) continue

      const { error } = await supabase
        .from('ad_insights_cache')
        .upsert(batch, { onConflict: 'ad_account_id,campaign_id,ad_set_id,ad_id,insight_level,date' })

      if (error) {
        errors.push(`Insights batch (${level}): ${error.message}`)
      } else {
        totalRowsSynced += batch.length
      }
    }
  }

  // 4. Campaign-level insights (paginated)
  const { allData: campaignInsightsData, header: cih } = await fetchAllPages(
    `${GRAPH_API}/act_${adAccountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&level=campaign&time_increment=1&time_range=${timeRange}&limit=500&access_token=${accessToken}`
  )
  totalApiCalls++
  rateLimitHeader = cih

  if (campaignInsightsData.length > 0) {
    await upsertInsights(campaignInsightsData, 'campaign')
  }

  // 5. Ad Set-level insights (paginated)
  const { allData: adsetInsightsData, header: aih } = await fetchAllPages(
    `${GRAPH_API}/act_${adAccountId}/insights?fields=campaign_id,adset_id,adset_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values&level=adset&time_increment=1&time_range=${timeRange}&limit=500&access_token=${accessToken}`
  )
  totalApiCalls++
  rateLimitHeader = aih

  if (adsetInsightsData.length > 0) {
    await upsertInsights(adsetInsightsData, 'adset')
  }

  // 6. Ad-level insights (paginated)
  const { allData: adInsightsData, header: adi } = await fetchAllPages(
    `${GRAPH_API}/act_${adAccountId}/insights?fields=campaign_id,adset_id,ad_id,ad_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values&level=ad&time_increment=1&time_range=${timeRange}&limit=500&access_token=${accessToken}`
  )
  totalApiCalls++
  rateLimitHeader = adi

  if (adInsightsData.length > 0) {
    await upsertInsights(adInsightsData, 'ad')
  }

  return { totalApiCalls, totalRowsSynced, errors, rateLimitHeader }
  } finally {
    // CORREÇÃO W9 (auditoria tracking): libera o advisory lock ao final do sync
    // (sucesso ou erro). Setamos sync_lock_until = NULL para permitir próximos syncs.
    await supabase
      .from('ad_accounts')
      .update({ sync_lock_until: null })
      .eq('ad_account_id', adAccountId)
      .eq('user_id', userId)
      .eq('sync_lock_until', lockUntil)
      .then(({ error }) => {
        if (error && !/column .* does not exist/i.test(error.message)) {
          console.warn('[Meta Sync] Failed to release lock:', error.message)
        }
      })
  }
}
