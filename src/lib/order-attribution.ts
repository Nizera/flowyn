import { createAdminClient } from '@/utils/supabase/admin'

type AttributionResult = {
  orderId: string
  matched: boolean
  campaignId?: string
  adAccountId?: string
}

export async function materializeOrderAttributions(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const supabase = createAdminClient()
  const errors: string[] = []
  let created = 0
  let skipped = 0

  // 1. Fetch user's campaigns from local DB
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('campaign_id, ad_account_id, name')
    .eq('user_id', userId)

  if (!campaigns || campaigns.length === 0) {
    return { created: 0, skipped: 0, errors: ['No campaigns found'] }
  }

  // Build lookup maps
  const campaignById: Record<string, { campaign_id: string; ad_account_id: string; name: string }> = {}
  const campaignByName: Record<string, { campaign_id: string; ad_account_id: string; name: string }> = {}
  for (const c of campaigns) {
    campaignById[c.campaign_id] = c
    if (c.name) {
      campaignByName[c.name.toLowerCase()] = c
    }
  }

  // 2. Fetch orders that have utm_campaign but no attribution yet
  let ordersQuery = supabase
    .from('orders')
    .select('id, amount, tracking_params, created_at, product:products!inner(owner_id)')
    .eq('product.owner_id', userId)
    .not('tracking_params', 'is', null)

  if (startDate) {
    ordersQuery = ordersQuery.gte('created_at', startDate)
  }
  if (endDate) {
    ordersQuery = ordersQuery.lte('created_at', endDate + 'T23:59:59')
  }

  const { data: orders, error: ordersError } = await ordersQuery

  if (ordersError) {
    return { created: 0, skipped: 0, errors: [ordersError.message] }
  }

  if (!orders || orders.length === 0) {
    return { created: 0, skipped: 0, errors: [] }
  }

  // 3. Fetch existing attributions to avoid duplicates
  const orderIds = orders.map(o => o.id)
  const { data: existingAttrs } = await supabase
    .from('order_attributions')
    .select('order_id')
    .in('order_id', orderIds)

  const existingOrderIds = new Set((existingAttrs || []).map(a => a.order_id))

  // 4. Match orders to campaigns and insert attributions
  for (const order of orders) {
    if (existingOrderIds.has(order.id)) {
      skipped++
      continue
    }

    const trackingParams = order.tracking_params as any
    const utmCampaign = trackingParams?.utm_campaign
    if (!utmCampaign) {
      skipped++
      continue
    }

    let matchedCampaign: { campaign_id: string; ad_account_id: string } | null = null
    let matchField = ''
    let matchValue = utmCampaign

    // Try matching by campaign ID first
    if (campaignById[utmCampaign]) {
      matchedCampaign = campaignById[utmCampaign]
      matchField = 'campaign_id'
    } else if (campaignByName[utmCampaign.toLowerCase()]) {
      // Try matching by campaign name
      matchedCampaign = campaignByName[utmCampaign.toLowerCase()]
      matchField = 'campaign_name'
    }

    if (matchedCampaign) {
      const { error: insertError } = await supabase.from('order_attributions').insert({
        order_id: order.id,
        user_id: userId,
        ad_account_id: matchedCampaign.ad_account_id,
        campaign_id: matchedCampaign.campaign_id,
        attribution_type: 'utm',
        match_field: matchField,
        match_value: matchValue,
        attributed_revenue: parseFloat(order.amount) || 0,
        attributed_quantity: 1,
      })

      if (insertError) {
        errors.push(`Order ${order.id}: ${insertError.message}`)
      } else {
        created++
      }
    } else {
      skipped++
    }
  }

  return { created, skipped, errors }
}
