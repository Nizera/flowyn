import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDecryptedToken } from '@/lib/meta-oauth'
import { GRAPH_API } from '@/lib/meta-graph-api'

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
  const fallbackTotalProductionCostLegacy = productCosts.reduce((sum: number, item: { cost?: string | number }) => sum + (parseFloat(String(item.cost)) || 0), 0)

  const admin = createAdminClient()

  // Fetch disabled campaign IDs for this user
  const { data: userCampaigns } = await admin
    .from('campaigns')
    .select('campaign_id, sync_enabled')
    .eq('user_id', user.id)

  const disabledCampaignIds = new Set(
    (userCampaigns || [])
      .filter(c => c.sync_enabled === false)
      .map(c => c.campaign_id)
  )

  // 2. Fetch campaign-level insights (not adset/ad to avoid double-counting)
  let insightsQuery = admin
    .from('ad_insights_cache')
    .select('*')
    .eq('insight_level', 'campaign')
    .gte('date', startDate)
    .lte('date', endDate)

  if (adAccountId) {
    insightsQuery = insightsQuery.eq('ad_account_id', adAccountId)
  }

  // Verify user owns the ad account(s)
  const { data: ownedAccounts, error: ownedError } = await admin
    .from('ad_accounts')
    .select('ad_account_id')
    .eq('user_id', user.id)

  const ownedAccountIds = (ownedAccounts || []).map((a: { ad_account_id: string }) => a.ad_account_id)
  console.log(`[dashboard] owned accounts: ${ownedAccountIds.length}, ids: ${ownedAccountIds.join(', ')}, ownedError: ${ownedError?.message || 'none'}`)

  // Defensive: if adAccountId was provided, explicitly verify ownership
  if (adAccountId && !ownedAccountIds.includes(adAccountId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (ownedAccountIds.length > 0) {
    insightsQuery = insightsQuery.in('ad_account_id', ownedAccountIds)
  }

  const { data: rawInsights, error: insightsError } = await insightsQuery

  // Filter out disabled campaigns from insights
  const insights = (rawInsights || []).filter(i => !disabledCampaignIds.has(i.campaign_id))

  const totalCachedSpend = insights.reduce((sum, i) => sum + (parseFloat(i.spend || '0') || 0), 0)
  console.log(`[dashboard] cached insights: ${insights.length}, totalCachedSpend: R$ ${totalCachedSpend}`)

  if (insightsError) {
    console.error('[dashboard] insights fetch failed', insightsError.message)
  }

  // Fallback: if no insights or all spend is zero, fetch from Meta API
  let effectiveInsights = insights
  const hasSpendData = effectiveInsights.some(i => parseFloat(i.spend || '0') > 0)
  if (!hasSpendData || effectiveInsights.length === 0) {
    console.log(`[dashboard] no spend in cache (hasSpendData=${hasSpendData}, count=${effectiveInsights.length}), falling back to Meta API`)
    const fallbackInsights: any[] = []
    let accountsToFetch = ownedAccountIds.length > 0 ? [...ownedAccountIds] : []

    // If no owned accounts found via ad_accounts table, try to find them via campaigns table
    if (accountsToFetch.length === 0) {
      const { data: campaignAccounts } = await admin
        .from('campaigns')
        .select('ad_account_id')
        .eq('user_id', user.id)
      const campaignAccountIds = [...new Set((campaignAccounts || []).map((c: { ad_account_id: string }) => c.ad_account_id))]
      if (campaignAccountIds.length > 0) {
        console.log(`[dashboard] found ${campaignAccountIds.length} accounts via campaigns table`)
        accountsToFetch = campaignAccountIds
      }
    }

    for (const accountId of accountsToFetch) {
      const accessToken = await getDecryptedToken(accountId, user.id)
      if (!accessToken) {
        console.log(`[dashboard] no token for account ${accountId}, skipping`)
        continue
      }

      try {
        console.log(`[dashboard] fetching Meta API for account ${accountId}, range: ${startDate} to ${endDate}`)

        // First: try campaign-level insights
        const metaRes = await fetch(
          `${GRAPH_API}/act_${accountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values&level=campaign&time_increment=1&time_range={'since':'${startDate}','until':'${endDate}'}&limit=500&access_token=${accessToken}`
        )
        const metaData = await metaRes.json()

        if (metaData.error) {
          console.error(`[dashboard] Meta API error for ${accountId}:`, JSON.stringify(metaData.error))
        }

        let campaignRows: any[] = metaData.data || []
        console.log(`[dashboard] Meta API campaign-level: ${campaignRows.length} rows`)

        // Check if campaign-level has real spend data
        const totalCampaignSpend = campaignRows.reduce((sum: number, r: any) => sum + (parseFloat(r.spend || '0') || 0), 0)
        console.log(`[dashboard] campaign-level total spend: R$ ${totalCampaignSpend}`)

        // If campaign-level spend is 0, also fetch ad-level and aggregate up
        if (totalCampaignSpend === 0 && campaignRows.length > 0) {
          console.log(`[dashboard] campaign-level spend is 0, fetching ad-level insights to aggregate`)

          // First try: ad-level WITHOUT time_increment (aggregated totals for the whole period)
          // Messaging campaigns often don't report spend in daily breakdowns
          let adAllData: any[] = []
          let adUrl: string | null = `${GRAPH_API}/act_${accountId}/insights?fields=campaign_id,campaign_name,ad_id,ad_name,impressions,clicks,spend,ctr,cpc,cpm,actions,action_values&level=ad&time_range={'since':'${startDate}','until':'${endDate}'}&limit=500&access_token=${accessToken}`

          const adRes = await fetch(adUrl)
          const adData = await adRes.json()

          if (adData.error) {
            console.error(`[dashboard] ad-level API error:`, JSON.stringify(adData.error))
          }

          if (adData.data) {
            adAllData.push(...adData.data)
            console.log(`[dashboard] ad-level (no time_increment): ${adData.data.length} rows`)

            // Check total spend
            const totalAdSpend = adAllData.reduce((s: number, r: any) => s + (parseFloat(r.spend || '0') || 0), 0)
            console.log(`[dashboard] ad-level total spend (aggregated): R$ ${totalAdSpend}`)

            // If still 0, also try daily breakdown as fallback
            if (totalAdSpend === 0) {
              console.log(`[dashboard] aggregated ad-level also has 0 spend, trying daily breakdown`)
              let dailyUrl: string | null = `${GRAPH_API}/act_${accountId}/insights?fields=campaign_id,campaign_name,ad_id,ad_name,impressions,clicks,spend,ctr,cpc,cpm,actions,action_values&level=ad&time_increment=1&time_range={'since':'${startDate}','until':'${endDate}'}&limit=500&access_token=${accessToken}`
              adAllData = []
              while (dailyUrl) {
                const dr: Response = await fetch(dailyUrl)
                const dd: any = await dr.json()
                if (dd.error) break
                if (dd.data) adAllData.push(...dd.data)
                dailyUrl = dd.paging?.next || null
                if (dailyUrl) await new Promise(r => setTimeout(r, 200))
              }
              console.log(`[dashboard] ad-level (daily): ${adAllData.length} rows`)
            }
          }

          if (adAllData.length > 0) {
            // Aggregate ad-level data by campaign+date (for daily) or campaign (for aggregated)
            const adAggregated: Record<string, any> = {}
            for (const row of adAllData) {
              const dateKey = row.date_start || 'total'
              const key = `${row.campaign_id}_${dateKey}`
              if (!adAggregated[key]) {
                adAggregated[key] = {
                  campaign_id: row.campaign_id,
                  campaign_name: row.campaign_name || '',
                  spend: 0,
                  impressions: 0,
                  clicks: 0,
                  reach: 0,
                  date: dateKey === 'total' ? today : dateKey,
                }
              }
              adAggregated[key].spend += parseFloat(row.spend || '0')
              adAggregated[key].impressions += parseInt(row.impressions || '0')
              adAggregated[key].clicks += parseInt(row.clicks || '0')
              adAggregated[key].reach += parseInt(row.reach || '0')
            }
            // Replace campaign rows with aggregated ad-level data
            campaignRows = Object.values(adAggregated)
            const totalAdSpend = campaignRows.reduce((s: number, r: any) => s + (parseFloat(r.spend) || 0), 0)
            console.log(`[dashboard] aggregated to ${campaignRows.length} rows from ad-level, total spend: R$ ${totalAdSpend}`)

            for (const row of campaignRows) {
              console.log(`[dashboard]   ad-agg: ${row.campaign_name} date=${row.date} spend=${row.spend} impressions=${row.impressions}`)
            }
          } else {
            console.log(`[dashboard] ad-level returned no data`)
          }

          // Final fallback: if ad-level also returned 0 spend, try account-level insights
          const totalAfterAdLevel = campaignRows.reduce((s: number, r: any) => s + (parseFloat(r.spend) || 0), 0)
          if (totalAfterAdLevel === 0) {
            console.log(`[dashboard] all levels returned 0 spend, trying account-level insights`)
            try {
              const acctRes = await fetch(
                `${GRAPH_API}/act_${accountId}/insights?fields=spend,impressions,clicks,actions,action_values&time_increment=1&time_range={'since':'${startDate}','until':'${endDate}'}&limit=500&access_token=${accessToken}`
              )
              const acctData = await acctRes.json()
              if (acctData.data && acctData.data.length > 0) {
                console.log(`[dashboard] account-level returned ${acctData.data.length} rows`)
                const acctSpend = acctData.data.reduce((s: number, r: any) => s + (parseFloat(r.spend || '0') || 0), 0)
                console.log(`[dashboard] account-level total spend: R$ ${acctSpend}`)
                if (acctSpend > 0) {
                  // Distribute account-level spend proportionally across campaigns
                  const campaignCount = new Set(campaignRows.map((r: any) => r.campaign_id)).size || 1
                  const perCampaignSpend = acctSpend / campaignCount
                  const campaignNames = [...new Set(campaignRows.map((r: any) => r.campaign_name))]
                  // Create synthetic rows with account-level spend
                  const acctRows: any[] = []
                  for (const day of acctData.data) {
                    const daySpend = parseFloat(day.spend || '0') || 0
                    if (daySpend <= 0) continue
                    const perCamp = daySpend / campaignCount
                    for (const campName of campaignNames) {
                      const existingRow = campaignRows.find((r: any) => r.campaign_name === campName && r.date === day.date_start)
                      if (existingRow && existingRow.spend === 0) {
                        existingRow.spend = perCamp
                      }
                    }
                  }
                  const totalFinal = campaignRows.reduce((s: number, r: any) => s + (parseFloat(r.spend) || 0), 0)
                  console.log(`[dashboard] after account-level distribution, total spend: R$ ${totalFinal}`)
                }
              } else if (acctData.error) {
                console.error(`[dashboard] account-level error:`, JSON.stringify(acctData.error))
              }
            } catch (err) {
              console.error(`[dashboard] account-level fallback error:`, err)
            }
          }
        }

        for (const row of campaignRows) {
          if (disabledCampaignIds.has(row.campaign_id)) continue
          const parsed = {
            ad_account_id: accountId,
            campaign_id: row.campaign_id,
            campaign_name: row.campaign_name || '',
            spend: parseFloat(row.spend || '0'),
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            reach: parseInt(row.reach || '0'),
            date: row.date_start || row.date || today,
            actions: row.actions || [],
            action_values: row.action_values || [],
          }
          fallbackInsights.push(parsed)
        }
      } catch (err) {
        console.error(`[dashboard] Meta API fallback error for ${accountId}:`, err)
      }
    }

    if (fallbackInsights.length > 0) {
      effectiveInsights = fallbackInsights
      console.log(`[dashboard] Meta API fallback yielded ${fallbackInsights.length} rows, total spend: R$ ${fallbackInsights.reduce((s, i) => s + i.spend, 0)}`)
    } else {
      console.log(`[dashboard] Meta API fallback returned no data`)
    }
  }

  // 3. Aggregate spend by campaign
  const campaignSpendMap: Record<string, { campaign_id: string; campaign_name: string; spend: number; impressions: number; clicks: number }> = {}
  for (const insight of effectiveInsights) {
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
  
  // Novos cálculos (null-safe: orders may be null from Supabase)
  const safeOrders = orders || []
  const pendingRevenue = safeOrders.filter(o => o.status === 'pending').reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0)
  const refundedRevenue = safeOrders.filter(o => o.status === 'refunded').reduce((sum, o) => sum + (parseFloat(o.net_value ?? o.amount) || 0), 0)
  const profitMargin = totalAttributedRevenue > 0 ? (netProfit / totalAttributedRevenue) * 100 : 0
  const arpu = totalAttributedOrders > 0 ? totalAttributedRevenue / totalAttributedOrders : 0
  const chargebackCount = safeOrders.filter(o => o.status === 'chargeback').length
  const chargebackRevenue = safeOrders.filter(o => o.status === 'chargeback').reduce((sum, o) => sum + (parseFloat(o.net_value ?? o.amount) || 0), 0)
  const chargebackRate = safeOrders.length > 0 ? ((safeOrders.filter(o => o.status === 'refunded').length + chargebackCount) / safeOrders.length) * 100 : 0

  // Aggregate impressions, clicks for CTR/CPC/CPM
  const totalImpressions = Object.values(campaignSpendMap).reduce((sum, c) => sum + c.impressions, 0)
  const totalClicks = Object.values(campaignSpendMap).reduce((sum, c) => sum + c.clicks, 0)
  const aggregateCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const aggregateCPC = totalClicks > 0 ? totalSpend / totalClicks : 0
  const aggregateCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0

  // 9. Spend over time (daily aggregation)
  const spendByDay: Record<string, number> = {}
  const revenueByDay: Record<string, number> = {}
  for (const insight of effectiveInsights) {
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
      chargeback_count: chargebackCount,
      chargeback_revenue: chargebackRevenue,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      aggregate_ctr: aggregateCTR,
      aggregate_cpc: aggregateCPC,
      aggregate_cpm: aggregateCPM,
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
