import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { requireProPlan } from '@/lib/subscription'

type CampaignAttribution = {
  campaign_id: string
  campaign_name: string
  ad_account_id: string
  total_spend: number
  total_clicks: number
  total_impressions: number
  total_reach: number
  total_leads: number
  total_landing_page_views: number
  total_initiate_checkout: number
  avg_cpc: number
  avg_cpm: number
  avg_ctr: number
  avg_cpv: number
  avg_cpi: number
  avg_cpa: number
  attributed_orders: number
  attributed_revenue: number
  gross_profit: number
  total_fees: number
  total_taxes: number
  total_production_costs: number
  net_profit: number
  roas: number
  roi: number
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

  try {
    const rawBody = await req.text()
    if (rawBody.length > 16_384) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }
    const body = JSON.parse(rawBody)
    const { ad_account_id, start_date, end_date } = body

    if (!ad_account_id || !start_date || !end_date) {
      return NextResponse.json({ error: 'ad_account_id, start_date, end_date required' }, { status: 400 })
    }

    // 1. Verify user owns this ad account
    const { data: accountOwner } = await supabase
      .from('ad_accounts')
      .select('user_id')
      .eq('ad_account_id', ad_account_id)
      .eq('user_id', user.id)
      .single()

    if (!accountOwner) {
      return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 404 })
    }

    // 2. Fetch campaign-level ad insights for the period (NOT adset/ad to avoid double-counting)
    const { data: insights, error: insightsError } = await supabase
      .from('ad_insights_cache')
      .select('*')
      .eq('ad_account_id', ad_account_id)
      .eq('insight_level', 'campaign')
      .gte('date', start_date)
      .lte('date', end_date)

    if (insightsError) {
      console.error('[Attribution] Insights error:', insightsError)
      return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
    }

    // 2. Fetch cost configurations
    const { data: costConfig } = await supabase
      .from('cost_configurations')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const taxPercentage = costConfig?.tax_percentage || 0
    const productCosts = costConfig?.product_costs || []

    // 3. Fetch orders with tracking_params that have utm_campaign (only user's orders)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*, product:products!inner(owner_id)')
      .eq('status', 'paid')
      .eq('product.owner_id', user.id)
      .gte('created_at', start_date)
      .lte('created_at', end_date + 'T23:59:59')

    if (ordersError) {
      console.error('[Attribution] Orders error:', ordersError)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    // 4. Build campaign attribution map
    const campaignMap: Record<string, CampaignAttribution> = {}

    // Initialize with insights data
    for (const insight of insights || []) {
      if (!campaignMap[insight.campaign_id]) {
        campaignMap[insight.campaign_id] = {
          campaign_id: insight.campaign_id,
          campaign_name: insight.campaign_name,
          ad_account_id: insight.ad_account_id,
          total_spend: 0,
          total_clicks: 0,
          total_impressions: 0,
          total_reach: 0,
          total_leads: 0,
          total_landing_page_views: 0,
          total_initiate_checkout: 0,
          avg_cpc: 0,
          avg_cpm: 0,
          avg_ctr: 0,
          avg_cpv: 0,
          avg_cpi: 0,
          avg_cpa: 0,
          attributed_orders: 0,
          attributed_revenue: 0,
          gross_profit: 0,
          total_fees: 0,
          total_taxes: 0,
          total_production_costs: 0,
          net_profit: 0,
          roas: 0,
          roi: 0,
        }
      }

      const campaign = campaignMap[insight.campaign_id]
      campaign.total_spend += parseFloat(insight.spend) || 0
      campaign.total_clicks += insight.clicks || 0
      campaign.total_impressions += insight.impressions || 0
      campaign.total_reach += insight.reach || 0
      campaign.total_leads += insight.leads || 0
      campaign.total_landing_page_views += insight.landing_page_views || 0
      campaign.total_initiate_checkout += insight.initiate_checkout || 0
    }

    // CORREÇÃO W7 (auditoria tracking): o matching por nome era O(n×m) — para cada
    // order fazíamos um scan linear em campaignMap. Agora pré-construímos um lookup
    // Map<nameLowercase, campaignId> uma única vez. Fica O(n+m).
    const campaignNameLookup = new Map<string, string>()
    for (const [campaignId, campaign] of Object.entries(campaignMap)) {
      if (campaign.campaign_name) {
        campaignNameLookup.set(campaign.campaign_name.toLowerCase(), campaignId)
      }
    }

    // 5. Attribute orders to campaigns based on utm_campaign matching campaign_id
    for (const order of orders || []) {
      const trackingParams = order.tracking_params as any
      if (!trackingParams) continue

      const utmCampaign = trackingParams.utm_campaign
      if (!utmCampaign) continue

      // Try to match by campaign ID first, then by name via pre-built lookup
      let matchedCampaignId: string | null = null

      if (campaignMap[utmCampaign]) {
        matchedCampaignId = utmCampaign
      } else {
        matchedCampaignId = campaignNameLookup.get(utmCampaign.toLowerCase()) ?? null
      }

      if (matchedCampaignId && campaignMap[matchedCampaignId]) {
        const campaign = campaignMap[matchedCampaignId]
        campaign.attributed_orders += 1
        campaign.attributed_revenue += parseFloat(order.net_value ?? order.amount) || 0
      }
    }

    // 6. Calculate financial metrics
    // CORREÇÃO W8 (auditoria tracking): production cost era aplicado flat a TODAS as
    // campanhas — somava todos os custos em cost_configurations.product_costs e
    // atribuía o mesmo total a cada campaign. Agora tentamos casar product_costs por
    // product_id (se existir) para dividir o custo corretamente; se não houver
    // product_id no cost entry, fallback para soma flat legacy.
    const productCostMap = new Map<string, number>()
    for (const item of (productCosts || [])) {
      const pid = (item as any).product_id as string | undefined
      const cost = parseFloat(item.cost) || 0
      if (pid) {
        productCostMap.set(pid, (productCostMap.get(pid) || 0) + cost)
      }
    }
    const fallbackTotalProductionCost = (productCosts || [])
      .filter((item: any) => !item.product_id)
      .reduce((sum: number, item: any) => sum + (parseFloat(item.cost) || 0), 0)

    for (const campaign of Object.values(campaignMap)) {
      // Per-campaign production cost: sum cost of each attributed product (by product_id)
      // — se não conseguirmos casar product_id, distribuímos o fallback proporcionalmente
      // ao número de orders atribuídos a esta campaign.
      const attributedProductIds = ((orders as any[]) || [])
        .filter(o => {
          const tp = o.tracking_params as any
          return tp?.utm_campaign
            && (tp.utm_campaign === campaign.campaign_id
                || campaignNameLookup.get(String(tp.utm_campaign).toLowerCase()) === campaign.campaign_id)
        })
        .map(o => o.product_id)
        .filter(Boolean)
      const uniqueProductIds = new Set(attributedProductIds)
      let campaignProductionCost = 0
      for (const pid of uniqueProductIds) {
        campaignProductionCost += productCostMap.get(pid) || 0
      }
      if (uniqueProductIds.size === 0) {
        // Sem product_id em nenhum order atribuído — fallback flat
        campaignProductionCost = fallbackTotalProductionCost
      }

      // Calculate taxes
      campaign.total_taxes = campaign.attributed_revenue * (taxPercentage / 100)
      campaign.total_fees = 0
      campaign.total_production_costs = campaignProductionCost

      // Calculate profits
      campaign.gross_profit = campaign.attributed_revenue - campaign.total_spend
      campaign.net_profit = campaign.attributed_revenue 
        - campaign.total_spend 
        - campaign.total_taxes 
        - campaign.total_production_costs

      // Calculate ROAS and ROI
      campaign.roas = campaign.total_spend > 0 
        ? campaign.attributed_revenue / campaign.total_spend 
        : 0
      campaign.roi = campaign.total_spend > 0 
        ? (campaign.net_profit / campaign.total_spend) * 100 
        : 0

      // Calculate averages
      campaign.avg_cpc = campaign.total_clicks > 0 
        ? campaign.total_spend / campaign.total_clicks 
        : 0
      campaign.avg_cpm = campaign.total_impressions > 0 
        ? (campaign.total_spend / campaign.total_impressions) * 1000 
        : 0
      campaign.avg_ctr = campaign.total_impressions > 0 
        ? (campaign.total_clicks / campaign.total_impressions) * 100 
        : 0
      campaign.avg_cpv = campaign.total_landing_page_views > 0 
        ? campaign.total_spend / campaign.total_landing_page_views 
        : 0
      campaign.avg_cpi = campaign.total_initiate_checkout > 0 
        ? campaign.total_spend / campaign.total_initiate_checkout 
        : 0
      campaign.avg_cpa = campaign.attributed_orders > 0 
        ? campaign.total_spend / campaign.attributed_orders 
        : 0
    }

    return NextResponse.json({ 
      campaigns: Object.values(campaignMap),
      period: { start_date, end_date },
      summary: {
        total_spend: Object.values(campaignMap).reduce((sum, c) => sum + c.total_spend, 0),
        total_revenue: Object.values(campaignMap).reduce((sum, c) => sum + c.attributed_revenue, 0),
        total_net_profit: Object.values(campaignMap).reduce((sum, c) => sum + c.net_profit, 0),
        total_orders: Object.values(campaignMap).reduce((sum, c) => sum + c.attributed_orders, 0),
        overall_roas: Object.values(campaignMap).reduce((sum, c) => sum + c.total_spend, 0) > 0
          ? Object.values(campaignMap).reduce((sum, c) => sum + c.attributed_revenue, 0) / 
            Object.values(campaignMap).reduce((sum, c) => sum + c.total_spend, 0)
          : 0,
      }
    })
  } catch (error) {
    console.error('[Attribution] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
