import { createAdminClient } from '@/utils/supabase/admin'

type AttributionResult = {
  orderId: string
  matched: boolean
  campaignId?: string
  adAccountId?: string
}

/**
 * Tenta matchar uma order com uma campanha usando múltiplos campos.
 * Retorna o campaign matchado e o campo utilizado no match (para auditoria).
 */
function matchOrderToCampaign(
  trackingParams: Record<string, string> | null,
  campaignById: Record<string, { campaign_id: string; ad_account_id: string; name: string }>,
  campaignByName: Record<string, { campaign_id: string; ad_account_id: string; name: string }>,
): { campaign: { campaign_id: string; ad_account_id: string } | null; matchField: string; matchValue: string } {
  if (!trackingParams) return { campaign: null, matchField: '', matchValue: '' }

  const utmCampaign = trackingParams.utm_campaign
  const utmSource = trackingParams.utm_source
  const src = trackingParams.src

  // 1. Match por utm_campaign → campaign_id direto
  if (utmCampaign && campaignById[utmCampaign]) {
    return { campaign: campaignById[utmCampaign], matchField: 'campaign_id', matchValue: utmCampaign }
  }

  // 2. Match por utm_campaign → campaign name (case-insensitive)
  if (utmCampaign && campaignByName[utmCampaign.toLowerCase()]) {
    return { campaign: campaignByName[utmCampaign.toLowerCase()], matchField: 'campaign_name', matchValue: utmCampaign }
  }

  // 3. Match por fbclid (Meta click ID) — requer dados de attribution do Meta
  //    Por enquanto, não temos acesso local. Se futuramente integrarmos a API de
  //    Attribution do Meta, este é o ponto de inserção.
  if (trackingParams.fbclid) {
    return { campaign: null, matchField: 'fbclid', matchValue: trackingParams.fbclid }
  }

  // 4. Match por gclid (Google Ads click ID) — idem
  if (trackingParams.gclid) {
    return { campaign: null, matchField: 'gclid', matchValue: trackingParams.gclid }
  }

  // 5. Match por src (custom param do produtor — ex: src=campanha_xyz)
  //    Usa como último fallback: tenta matchar como campaign name
  if (src && campaignByName[src.toLowerCase()]) {
    return { campaign: campaignByName[src.toLowerCase()], matchField: 'src', matchValue: src }
  }

  return { campaign: null, matchField: '', matchValue: '' }
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

  // 2. Fetch orders that have tracking_params but no attribution yet
  let ordersQuery = supabase
    .from('orders')
    .select('id, net_value, amount, tracking_params, created_at, product:products!inner(owner_id)')
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
    .select('order_id, campaign_id')
    .in('order_id', orderIds)

  const existingKeys = new Set(
    (existingAttrs || []).map(a => `${a.order_id}:${a.campaign_id}`)
  )

  // 4. Match orders to campaigns and insert attributions
  for (const order of orders) {
    const trackingParams = order.tracking_params as Record<string, string> | null
    if (!trackingParams) {
      skipped++
      continue
    }

    const utmSource = trackingParams.utm_source || null
    const utmMedium = trackingParams.utm_medium || null
    const utmContent = trackingParams.utm_content || null
    const utmTerm = trackingParams.utm_term || null

    // Determine click ID
    let clickIdType: string | null = null
    let clickIdValue: string | null = null
    if (trackingParams.fbclid) {
      clickIdType = 'fbclid'
      clickIdValue = trackingParams.fbclid
    } else if (trackingParams.gclid) {
      clickIdType = 'gclid'
      clickIdValue = trackingParams.gclid
    } else if (trackingParams.ttclid) {
      clickIdType = 'ttclid'
      clickIdValue = trackingParams.ttclid
    }

    // Multi-field matching
    const { campaign: matchedCampaign, matchField, matchValue } = matchOrderToCampaign(
      trackingParams, campaignById, campaignByName
    )

    if (!matchedCampaign) {
      skipped++
      continue
    }

    const key = `${order.id}:${matchedCampaign.campaign_id}`
    if (existingKeys.has(key)) {
      skipped++
      continue
    }

    const revenue = parseFloat(order.net_value ?? order.amount) || 0

    const { error: insertError } = await supabase.from('order_attributions').insert({
      order_id: order.id,
      user_id: userId,
      ad_account_id: matchedCampaign.ad_account_id,
      campaign_id: matchedCampaign.campaign_id,
      attribution_type: 'utm',
      match_field: matchField,
      match_value: matchValue,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_content: utmContent,
      utm_term: utmTerm,
      click_id_type: clickIdType,
      click_id_value: clickIdValue,
      attributed_revenue: revenue,
      attributed_quantity: 1,
    })

    if (insertError) {
      errors.push(`Order ${order.id}: ${insertError.message}`)
    } else {
      created++
      existingKeys.add(key)
    }
  }

  return { created, skipped, errors }
}
