import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  const today = new Date().toISOString().slice(0, 10)
  const defaultStart = `${new Date().getFullYear()}-01-01`

  const startDate = searchParams.get('start_date') || defaultStart
  const endDate = searchParams.get('end_date') || today
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }
  if (startDate > endDate) {
    return NextResponse.json({ error: 'start_date must be <= end_date' }, { status: 400 })
  }
  const spanDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000
  if (spanDays > 365) {
    return NextResponse.json({ error: 'Date range cannot exceed 365 days' }, { status: 400 })
  }

  const adAccountId = searchParams.get('ad_account_id')
  if (adAccountId && !/^\d+$/.test(adAccountId)) {
    return NextResponse.json({ error: 'Invalid ad_account_id' }, { status: 400 })
  }

  const campaignIdsParam = searchParams.get('campaign_ids')
  const campaignIdsFilter = campaignIdsParam
    ? campaignIdsParam.split(',').map(s => s.trim()).filter(Boolean)
    : null

  const hasCampaignFilter = campaignIdsFilter !== null && campaignIdsFilter.length > 0

  // 1. Get user's owned ad accounts
  let accountsQuery = supabase
    .from('ad_accounts')
    .select('ad_account_id')
    .eq('user_id', user.id)

  if (adAccountId) {
    accountsQuery = accountsQuery.eq('ad_account_id', adAccountId)
  }

  const { data: ownedAccounts } = await accountsQuery
  const ownedAccountIds = (ownedAccounts || []).map((a: { ad_account_id: string }) => a.ad_account_id)

  if (ownedAccountIds.length === 0) {
    return NextResponse.json({
      stages: [
        { name: 'Cliques', value: 0 },
        { name: 'Visita na Página', value: 0 },
        { name: 'Initiate Checkout', value: 0 },
        { name: 'Vendas Iniciadas', value: 0 },
        { name: 'Vendas Aprovadas', value: 0 },
      ],
      conversion_rates: [],
      period: { start_date: startDate, end_date: endDate },
    })
  }

  const admin = (await import('@/utils/supabase/admin')).createAdminClient()
  const { data: userCampaigns } = await admin
    .from('campaigns')
    .select('campaign_id, sync_enabled')
    .eq('user_id', user.id)

  const disabledCampaignIds = new Set(
    (userCampaigns || [])
      .filter(c => c.sync_enabled === false)
      .map(c => c.campaign_id)
  )

  // 2. Get clicks + landing_page_views from ad_insights_cache (sync already stores landing_page_views)
  const insightsQuery = supabase
    .from('ad_insights_cache')
    .select('clicks, landing_page_views, campaign_id')
    .eq('insight_level', 'campaign')
    .gte('date', startDate)
    .lte('date', endDate)
    .in('ad_account_id', ownedAccountIds)

  const { data: rawInsights } = await insightsQuery
  let insights = (rawInsights || []).filter(i => !disabledCampaignIds.has(i.campaign_id))

  // Filter by selected campaign IDs if provided
  if (campaignIdsFilter && campaignIdsFilter.length > 0) {
    const selectedSet = new Set(campaignIdsFilter)
    insights = insights.filter(i => selectedSet.has(i.campaign_id))
  }

  let totalClicks = insights.reduce((sum: number, i: { clicks?: number }) => sum + (i.clicks || 0), 0)
  let cachedLandingPageViews = insights.reduce((sum: number, i: { landing_page_views?: number }) => sum + (i.landing_page_views || 0), 0)

  // Fallback: if cache is empty (sync hasn't run), fetch clicks from Meta API
  if (totalClicks === 0 && cachedLandingPageViews === 0 && ownedAccountIds.length > 0) {
    try {
      const { getDecryptedToken } = await import('@/lib/meta-oauth')
      const { GRAPH_API } = await import('@/lib/meta-graph-api')
      const accessToken = await getDecryptedToken(ownedAccountIds[0], user.id)
      if (accessToken) {
        let metaUrl: string | null = `${GRAPH_API}/act_${ownedAccountIds[0]}/insights?fields=campaign_id,clicks,actions&level=campaign&time_increment=1&time_range={'since':'${startDate}','until':'${endDate}'}&limit=500&access_token=${accessToken}`
        if (campaignIdsFilter && campaignIdsFilter.length > 0) {
          metaUrl += `&campaign_ids=[${campaignIdsFilter.map(id => `"${id}"`).join(',')}]`
        }
        while (metaUrl) {
          const res = await fetch(metaUrl)
          const data = await res.json()
          if (data.error) break
          if (data.data) {
            for (const row of data.data) {
              totalClicks += parseInt(row.clicks || '0') || 0
              if (row.actions && Array.isArray(row.actions)) {
                for (const action of row.actions) {
                  if (action.action_type === 'landing_page_view') {
                    cachedLandingPageViews += parseInt(action.value || '0') || 0
                  }
                }
              }
            }
          }
          metaUrl = data.paging?.next || null
          if (metaUrl) await new Promise(r => setTimeout(r, 200))
        }
      }
    } catch {}
  }

  // 3. Get user's products
  const { data: products } = await supabase
    .from('products')
    .select('id')
    .eq('owner_id', user.id)
  const productIds = (products || []).map((p: { id: string }) => p.id)

  if (productIds.length === 0) {
    return NextResponse.json({
      stages: [
        { name: 'Cliques', value: totalClicks },
        { name: 'Visita na Página', value: 0 },
        { name: 'Initiate Checkout', value: 0 },
        { name: 'Vendas Iniciadas', value: 0 },
        { name: 'Vendas Aprovadas', value: 0 },
      ],
      conversion_rates: [],
      period: { start_date: startDate, end_date: endDate },
    })
  }

  // 4. Get landing page views: preferir Meta API (mais preciso), fallback para tracking próprio
  const startDateTs = `${startDate}T00:00:00`
  const endDateTs = `${endDate}T23:59:59`

  // Fallback: contar de tracking_external_events + funnel_events (se Meta API não retornar)
  const { count: pageViewsCount } = await supabase
    .from('funnel_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', 'page_view')
    .in('product_id', productIds)
    .gte('created_at', startDateTs)
    .lte('created_at', endDateTs)

  const { count: externalPageViewsCount } = await supabase
    .from('tracking_external_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', 'page_view')
    .eq('user_id', user.id)
    .in('product_id', productIds)
    .gte('created_at', startDateTs)
    .lte('created_at', endDateTs)

  const { data: checkoutSessions } = await supabase
    .from('funnel_events')
    .select('session_id')
    .eq('event_name', 'page_view')
    .in('product_id', productIds)
    .gte('created_at', startDateTs)
    .lte('created_at', endDateTs)
    .not('session_id', 'is', null)

  const checkoutSessionIds = new Set(
    (checkoutSessions || []).map((s: { session_id: string }) => s.session_id).filter(Boolean)
  )

  let externalUniqueCount = 0
  if (externalPageViewsCount && externalPageViewsCount > 0) {
    const { data: externalEvents } = await supabase
      .from('tracking_external_events')
      .select('session_id')
      .eq('event_name', 'page_view')
      .eq('user_id', user.id)
      .in('product_id', productIds)
      .gte('created_at', startDateTs)
      .lte('created_at', endDateTs)

    externalUniqueCount = (externalEvents || []).filter(
      (e: { session_id: string }) => !e.session_id || !checkoutSessionIds.has(e.session_id)
    ).length
  }

  const ownTrackingPageViews = (pageViewsCount || 0) + externalUniqueCount

  // Usar landing_page_views do cache (sync já busca da Meta API), senão fallback para tracking próprio
  const pageViews = cachedLandingPageViews > 0 ? cachedLandingPageViews : ownTrackingPageViews

  // 4. Initiate checkouts: filter by campaign when filter is active
  let initiateCheckouts = 0
  if (hasCampaignFilter && campaignIdsFilter) {
    // Find session_ids that have matching utm_campaign in tracking_external_events
    const { data: matchingSessions } = await supabase
      .from('tracking_external_events')
      .select('session_id')
      .eq('event_name', 'page_view')
      .eq('user_id', user.id)
      .in('utm_campaign', campaignIdsFilter)
      .gte('created_at', startDateTs)
      .lte('created_at', endDateTs)

    const sessionIds = [...new Set((matchingSessions || []).map((s: { session_id: string }) => s.session_id).filter(Boolean))]

    if (sessionIds.length > 0) {
      const { count } = await supabase
        .from('funnel_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', 'initiate_checkout')
        .in('product_id', productIds)
        .in('session_id', sessionIds)
        .gte('created_at', startDateTs)
        .lte('created_at', endDateTs)
      initiateCheckouts = count || 0
    }
  } else {
    const { count } = await supabase
      .from('funnel_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'initiate_checkout')
      .in('product_id', productIds)
      .gte('created_at', startDateTs)
      .lte('created_at', endDateTs)
    initiateCheckouts = count || 0
  }

  // 5. Get orders count (pending + paid = sales_initiated, only paid = sales_approved)
  const { count: initiatedCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('product_id', productIds)
    .in('status', ['pending', 'paid'])
    .gte('created_at', startDateTs)
    .lte('created_at', endDateTs)

  const { count: approvedCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('product_id', productIds)
    .eq('status', 'paid')
    .gte('created_at', startDateTs)
    .lte('created_at', endDateTs)

  const salesInitiated = initiatedCount || 0
  const salesApproved = approvedCount || 0

  // When campaign filter is active, re-count orders that match the selected campaigns
  let filteredSalesInitiated = salesInitiated
  let filteredSalesApproved = salesApproved
  if (hasCampaignFilter) {
    // Fetch order details to check tracking_params
    const { data: filteredOrders } = await supabase
      .from('orders')
      .select('status, tracking_params')
      .in('product_id', productIds)
      .in('status', ['pending', 'paid'])
      .gte('created_at', startDateTs)
      .lte('created_at', endDateTs)

    // Also fetch campaign names to match utm_campaign (name) against selected IDs
    const { data: campNames } = await admin
      .from('campaigns')
      .select('campaign_id, name')
      .eq('user_id', user.id)
      .in('campaign_id', campaignIdsFilter || [])

    const selectedSet = new Set(campaignIdsFilter)
    const nameToId = new Map<string, string>()
    for (const c of campNames || []) {
      if (c.name && c.campaign_id) nameToId.set(c.name.toLowerCase().trim(), c.campaign_id)
    }

    function matchFunnelOrder(tp: Record<string, string> | null): boolean {
      if (!tp) return false
      if (tp.utm_campaign) {
        if (selectedSet.has(tp.utm_campaign)) return true
        const byName = nameToId.get(tp.utm_campaign.toLowerCase().trim())
        if (byName && selectedSet.has(byName)) return true
      }
      if (tp.src && selectedSet.has(tp.src)) return true
      if (tp.utm_source && tp.utm_medium && selectedSet.has(`${tp.utm_source}_${tp.utm_medium}`)) return true
      if ((tp.fbclid || tp._fbc) && selectedSet.size > 0) return true
      return false
    }

    const matched = (filteredOrders || []).filter(o => {
      const tp = o.tracking_params as Record<string, string> | null
      return matchFunnelOrder(tp)
    })

    filteredSalesInitiated = matched.length
    filteredSalesApproved = matched.filter(o => o.status === 'paid').length
  }

  const stages = [
    { name: 'Cliques', value: totalClicks },
    { name: 'Visita na Página', value: pageViews },
    { name: 'Initiate Checkout', value: initiateCheckouts },
    { name: 'Vendas Iniciadas', value: hasCampaignFilter ? filteredSalesInitiated : salesInitiated },
    { name: 'Vendas Aprovadas', value: hasCampaignFilter ? filteredSalesApproved : salesApproved },
  ]

  // 6. Calculate conversion rates between adjacent stages
  const conversionRates: { from: string; to: string; rate: number }[] = []
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i]
    const to = stages[i + 1]
    const rate = from.value > 0 ? (to.value / from.value) * 100 : 0
    conversionRates.push({ from: from.name, to: to.name, rate })
  }

  // 7. Add overall conversion (first → last)
  if (stages.length >= 2) {
    const first = stages[0]
    const last = stages[stages.length - 1]
    const overallRate = first.value > 0 ? (last.value / first.value) * 100 : 0
    conversionRates.push({ from: first.name, to: last.name, rate: overallRate })
  }

  return NextResponse.json({
    stages,
    conversion_rates: conversionRates,
    period: { start_date: startDate, end_date: endDate },
  })
}
