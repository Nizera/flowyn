import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { requireProPlan } from '@/lib/subscription'

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

  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('start_date') || `${new Date().getFullYear()}-01-01`
  const endDate = searchParams.get('end_date') || new Date().toISOString().slice(0, 10)
  const adAccountId = searchParams.get('ad_account_id') // optional: filter by account

  // 1. Fetch cost configuration
  const { data: costConfig } = await supabase
    .from('cost_configurations')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const taxPercentage = costConfig?.tax_percentage || 0
  const asaasFlatFee = costConfig?.asaas_flat_fee || 0
  const asaasPercentFee = costConfig?.asaas_percent_fee || 0
  const productCosts = costConfig?.product_costs || []
  const totalProductionCost = productCosts.reduce((sum: number, item: any) => sum + (parseFloat(item.cost) || 0), 0)

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

  const ownedAccountIds = (ownedAccounts || []).map((a: any) => a.ad_account_id)
  if (ownedAccountIds.length === 0) {
    return NextResponse.json({
      summary: { total_spend: 0, total_revenue: 0, net_profit: 0, total_orders: 0, roas: 0 },
      payment_breakdown: [],
      spend_over_time: [],
      campaigns: [],
    })
  }

  insightsQuery = insightsQuery.in('ad_account_id', ownedAccountIds)

  const { data: insights, error: insightsError } = await insightsQuery

  if (insightsError) {
    return NextResponse.json({ error: insightsError.message }, { status: 500 })
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
  let ordersQuery = supabase
    .from('orders')
    .select('*, product:products!inner(owner_id)')
    .eq('product.owner_id', user.id)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')

  const { data: orders, error: ordersError } = await ordersQuery

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 })
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

  // 6. Attribute orders to campaigns via utm_campaign
  let totalAttributedRevenue = 0
  let totalAttributedOrders = 0

  for (const order of orders || []) {
    if (order.status !== 'paid') continue
    const trackingParams = order.tracking_params as any
    if (!trackingParams?.utm_campaign) continue

    const utmCampaign = trackingParams.utm_campaign
    let matched = false

    // Try matching by campaign ID
    if (campaignSpendMap[utmCampaign]) {
      matched = true
    } else {
      // Try matching by campaign name
      for (const [id, camp] of Object.entries(campaignSpendMap)) {
        if (camp.campaign_name?.toLowerCase() === utmCampaign.toLowerCase()) {
          matched = true
          break
        }
      }
    }

    if (matched) {
      totalAttributedRevenue += parseFloat(order.amount) || 0
      totalAttributedOrders++
    }
  }

  // 7. Calculate total spend across all campaigns
  const totalSpend = Object.values(campaignSpendMap).reduce((sum, c) => sum + c.spend, 0)

  // 8. Calculate financial metrics
  const totalTaxes = totalAttributedRevenue * (taxPercentage / 100)
  const totalAsaasFees = (totalAttributedRevenue * (asaasPercentFee / 100)) + asaasFlatFee
  const totalFees = totalTaxes + totalAsaasFees
  const netProfit = totalAttributedRevenue - totalSpend - totalFees - totalProductionCost
  const roas = totalSpend > 0 ? totalAttributedRevenue / totalSpend : 0
  const roi = totalSpend > 0 ? (netProfit / totalSpend) * 100 : 0
  
  // Novos cálculos
  const pendingRevenue = orders.filter(o => o.status === 'pending').reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0)
  const refundedRevenue = orders.filter(o => o.status === 'refunded').reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0)
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
    const day = (order.created_at as string).slice(0, 10)
    revenueByDay[day] = (revenueByDay[day] || 0) + (parseFloat(order.amount) || 0)
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
      total_fees: totalFees,
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
    spend_over_time: spendOverTime,
    campaigns: campaignBreakdown,
    period: { start_date: startDate, end_date: endDate },
  })
}
