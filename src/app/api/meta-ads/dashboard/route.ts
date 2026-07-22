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

  // 1. Fetch cost configuration
  const { data: costConfig } = await supabase
    .from('cost_configurations')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const taxPercentage = costConfig?.tax_percentage || 0
  const productCosts = costConfig?.product_costs || []
  // CORREÇÃO W8 (auditoria tracking): o totalProductionCost legacy (flat, somando
  // todos os cost_configurations.product_costs) fica reservado como fallback. O
  // valor efetivamente atribuído é calculado depois (per-product_id quando possível).
  const fallbackTotalProductionCostLegacy = productCosts.reduce((sum: number, item: { cost?: string | number }) => sum + (parseFloat(String(item.cost)) || 0), 0)

  // 2. Fetch campaign-level insights (not adset/ad to avoid double-counting)
  let insightsQuery = supabase
    .from('ad_insights_cache')
    .select('*')
    .eq('insight_level', 'campaign')
    .gte('date', startDate)
    .lte('date', endDate)

  if (adAccountId) {
    insightsQuery = insightsQuery.eq('ad_account_id', adAccountId)
  }

  // Verify user owns the ad account(s)
  const { data: ownedAccounts } = await supabase
    .from('ad_accounts')
    .select('ad_account_id')
    .eq('user_id', user.id)

  const ownedAccountIds = (ownedAccounts || []).map((a: { ad_account_id: string }) => a.ad_account_id)
  if (ownedAccountIds.length === 0) {
    return NextResponse.json({
      summary: { total_spend: 0, total_revenue: 0, net_profit: 0, total_orders: 0, roas: 0 },
      payment_breakdown: [],
      spend_over_time: [],
      campaigns: [],
    })
  }

  // Defensive: if adAccountId was provided, explicitly verify ownership
  if (adAccountId && !ownedAccountIds.includes(adAccountId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  insightsQuery = insightsQuery.in('ad_account_id', ownedAccountIds)

  const { data: insights, error: insightsError } = await insightsQuery

  if (insightsError) {
    console.error('[dashboard] insights fetch failed', insightsError.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  // 3. Aggregate spend by campaign
  const campaignSpendMap: Record<string, { campaign_id: string; campaign_name: string; spend: number; impressions: number; clicks: number }> = {}
  for (const insight of insights || []) {
    const key = insight.campaign_id
    if (!campaignSpendMap[key]) {
      campaignSpendMap[key] = {
        campaign_id: insight.campaign_id,
        campaign_name: insight.campaign_name,
        spend: 0,
        impressions: 0,
        clicks: 0,
      }
    }
    campaignSpendMap[key].spend += parseFloat(insight.spend) || 0
    campaignSpendMap[key].impressions += insight.impressions || 0
    campaignSpendMap[key].clicks += insight.clicks || 0
  }

  // 4. Fetch orders with tracking_params for this user in date range
  const ordersQuery = supabase
    .from('orders')
    .select('*, product:products!inner(owner_id)')
    .eq('product.owner_id', user.id)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')

  const { data: orders, error: ordersError } = await ordersQuery

  if (ordersError) {
    console.error('[dashboard] orders fetch failed', ordersError.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  // 5. Build payment breakdown for donut chart
  const paymentBreakdown: Record<string, { count: number; total: number }> = {}
  for (const order of orders || []) {
    const status = order.status || 'unknown'
    if (!paymentBreakdown[status]) {
      paymentBreakdown[status] = { count: 0, total: 0 }
    }
    paymentBreakdown[status].count++
    paymentBreakdown[status].total += parseFloat(order.amount) || 0
  }

  // 6. Attribute orders to campaigns via multi-field matching
  let totalAttributedRevenue = 0
  let totalAttributedOrders = 0

  // CORREÇÃO W7 (auditoria tracking): pré-build do name → campaignId Map para evitar
  // scan O(n×m) a cada order.
  const campaignNameLookup = new Map<string, string>()
  for (const camp of Object.values(campaignSpendMap)) {
    if (camp.campaign_name) campaignNameLookup.set(camp.campaign_name.toLowerCase(), camp.campaign_id)
  }

  // CORREÇÃO W8 (auditoria tracking): per-product production cost lookup.
  const productCostMap = new Map<string, number>()
  for (const item of (productCosts || [])) {
    const pid = (item as { product_id?: string }).product_id
    const cost = parseFloat(String(item.cost)) || 0
    if (pid) productCostMap.set(pid, (productCostMap.get(pid) || 0) + cost)
  }
  const fallbackFlatProductionCost = (productCosts || [])
    .filter((item: { product_id?: string }) => !item.product_id)
    .reduce((sum: number, item: { cost?: string | number }) => sum + (parseFloat(String(item.cost)) || 0), 0)

  /** Tenta matchar uma order a uma campanha usando múltiplos campos */
  function matchOrder(params: Record<string, string> | null): boolean {
    if (!params) return false
    const utmCampaign = params.utm_campaign
    const utmSource = params.utm_source
    const src = params.src

    if (utmCampaign) {
      if (campaignSpendMap[utmCampaign]) return true
      if (campaignNameLookup.has(utmCampaign.toLowerCase())) return true
    }
    // Fallback: src como campaign name
    if (src && campaignNameLookup.has(src.toLowerCase())) return true
    // Fallback: utm_source + utm_medium como composite
    if (utmSource && params.utm_medium) {
      const compositeKey = `${utmSource}_${params.utm_medium}`
      if (campaignNameLookup.has(compositeKey.toLowerCase())) return true
    }
    return false
  }

  for (const order of orders || []) {
    if (order.status !== 'paid') continue
    const trackingParams = order.tracking_params as Record<string, string> | null
    if (!trackingParams) continue

    if (matchOrder(trackingParams)) {
      totalAttributedRevenue += parseFloat(order.net_value ?? order.amount) || 0
      totalAttributedOrders++
    }
  }

  // 7. Calculate total spend across all campaigns
  const totalSpend = Object.values(campaignSpendMap).reduce((sum, c) => sum + c.spend, 0)

  // CORREÇÃO W8 (auditoria tracking): production cost agregado por product_id quando
  // possível. Se cost_configurations não tiver product_id, fallback flat legacy.
  const attributedProductIds = new Set<string>()
  for (const order of orders || []) {
    if (order.status !== 'paid') continue
    const trackingParams = order.tracking_params as Record<string, string> | null
    if (!matchOrder(trackingParams)) continue
    if (order.product_id) attributedProductIds.add(order.product_id)
  }
  let totalProductionCost = 0
  for (const pid of attributedProductIds) totalProductionCost += productCostMap.get(pid) || 0
  if (attributedProductIds.size === 0) totalProductionCost = fallbackFlatProductionCost || fallbackTotalProductionCostLegacy
  // Calculate financial metrics (recoverados após W8 refactor)
  const totalTaxes = totalAttributedRevenue * (taxPercentage / 100)
  const netProfit = totalAttributedRevenue - totalSpend - totalTaxes - totalProductionCost
  const roas = totalSpend > 0 ? totalAttributedRevenue / totalSpend : 0
  const roi = totalSpend > 0 ? (netProfit / totalSpend) * 100 : 0
  
  // Total sales (all paid orders, not just attributed)
  const totalSalesAllOrders = (orders || [])
    .filter(o => o.status === 'paid')
    .reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0)
  
  // Novos cálculos
  const pendingRevenue = orders.filter(o => o.status === 'pending').reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0)
  const refundedRevenue = orders.filter(o => o.status === 'refunded').reduce((sum, o) => sum + (parseFloat(o.net_value ?? o.amount) || 0), 0)
  const profitMargin = totalAttributedRevenue > 0 ? (netProfit / totalAttributedRevenue) * 100 : 0
  const arpu = totalAttributedOrders > 0 ? totalAttributedRevenue / totalAttributedOrders : 0
  const chargebackRate = orders.length > 0 ? (orders.filter(o => o.status === 'refunded').length / orders.length) * 100 : 0

  // 9. Spend over time (daily aggregation)
  const spendByDay: Record<string, number> = {}
  const revenueByDay: Record<string, number> = {}
  for (const insight of insights || []) {
    const day = insight.date
    spendByDay[day] = (spendByDay[day] || 0) + (parseFloat(insight.spend) || 0)
  }
  for (const order of orders || []) {
    if (order.status !== 'paid') continue
    const trackingParams = order.tracking_params as Record<string, string> | null
    if (!matchOrder(trackingParams)) continue

    const day = (order.created_at as string).slice(0, 10)
    revenueByDay[day] = (revenueByDay[day] || 0) + (parseFloat(order.net_value ?? order.amount) || 0)
  }

  // Merge all days
  const allDays = [...new Set([...Object.keys(spendByDay), ...Object.keys(revenueByDay)])].sort()
  const spendOverTime = allDays.map(day => ({
    date: day,
    spend: spendByDay[day] || 0,
    revenue: revenueByDay[day] || 0,
  }))

  // 10. Campaign breakdown
  const campaignBreakdown = Object.values(campaignSpendMap).map(c => ({
    campaign_id: c.campaign_id,
    campaign_name: c.campaign_name,
    spend: c.spend,
    impressions: c.impressions,
    clicks: c.clicks,
    cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
    cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
  }))

  return NextResponse.json({
    summary: {
      total_spend: totalSpend,
      total_revenue: totalAttributedRevenue,
      total_sales: totalSalesAllOrders,
      total_taxes: totalTaxes,
      total_production_costs: totalProductionCost,
      net_profit: netProfit,
      total_orders: totalAttributedOrders,
      roas,
      roi,
      pending_revenue: pendingRevenue,
      refunded_revenue: refundedRevenue,
      profit_margin: profitMargin,
      arpu,
      chargeback_rate: chargebackRate,
    },
    payment_breakdown: Object.entries(paymentBreakdown).map(([status, data]) => ({
      status,
      count: data.count,
      total: data.total,
    })),
    // CORREÇÃO W10 (auditoria tracking): recent_sales retornava TODOS os pedidos,
    // incluindo reembolsados. Agora filtramos refunded/refused/cancelled para exibir
    // apenas vendas válidas no feed "vendas recentes" do dashboard.
    recent_sales: (orders || [])
      .filter(o => !['refunded', 'refused', 'cancelled', 'chargeback'].includes(o.status || ''))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(o => ({
        id: o.id,
        customer_name: o.customer_name,
        product_name: (o.product as { name?: string })?.name || null,
        amount: parseFloat(o.amount) || 0,
        status: o.status,
      })),
    spend_over_time: spendOverTime,
    campaigns: campaignBreakdown,
    period: { start_date: startDate, end_date: endDate },
  })
}
