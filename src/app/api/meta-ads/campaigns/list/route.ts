import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDecryptedToken } from '@/lib/meta-oauth'
import { GRAPH_API } from '@/lib/meta-graph-api'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const adAccountId = searchParams.get('ad_account_id')
  if (!adAccountId) return NextResponse.json({ error: 'ad_account_id required' }, { status: 400 })

  const admin = createAdminClient()

  // 1. Try local DB first
  const { data: campaigns } = await admin
    .from('campaigns')
    .select('campaign_id, name, status, effective_status, sync_enabled, daily_budget, lifetime_budget, objective')
    .eq('user_id', user.id)
    .eq('ad_account_id', adAccountId)
    .order('name', { ascending: true })

  // Filter out placeholder records from response (DO NOT delete from DB on GET)
  const realCampaigns = (campaigns || []).filter(c => c.name && c.name !== c.campaign_id)

  if (realCampaigns.length > 0) {
    const campaignIds = realCampaigns.map(c => c.campaign_id)

    const { data: insights } = await admin
      .from('ad_insights_cache')
      .select('campaign_id, spend, clicks, impressions, conversions, conversion_value')
      .eq('ad_account_id', adAccountId)
      .eq('insight_level', 'campaign')
      .in('campaign_id', campaignIds)

    const spendMap: Record<string, { spend: number; clicks: number; impressions: number; conversions: number; conversion_value: number }> = {}
    for (const row of insights || []) {
      if (!spendMap[row.campaign_id]) {
        spendMap[row.campaign_id] = { spend: 0, clicks: 0, impressions: 0, conversions: 0, conversion_value: 0 }
      }
      spendMap[row.campaign_id].spend += row.spend || 0
      spendMap[row.campaign_id].clicks += row.clicks || 0
      spendMap[row.campaign_id].impressions += row.impressions || 0
      spendMap[row.campaign_id].conversions += row.conversions || 0
      spendMap[row.campaign_id].conversion_value += row.conversion_value || 0
    }

    const enriched = realCampaigns.map(c => ({
      ...c,
      stats: spendMap[c.campaign_id] || { spend: 0, clicks: 0, impressions: 0, conversions: 0, conversion_value: 0 },
    }))

    return NextResponse.json({ campaigns: enriched })
  }

  // 2. Fallback: fetch directly from Meta API when local DB is empty
  const accessToken = await getDecryptedToken(adAccountId, user.id)
  if (!accessToken) {
    return NextResponse.json({ campaigns: [] })
  }

  try {
    const metaRes = await fetch(
      `${GRAPH_API}/act_${adAccountId}/campaigns?fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget,created_time&limit=500&access_token=${accessToken}`
    )
    const metaData = await metaRes.json()

    if (metaData.error) {
      console.error('[Campaigns List] Meta API error:', metaData.error.message)
      return NextResponse.json({ campaigns: [] })
    }

    const metaCampaigns = metaData.data || []
    const now = new Date()
    const since = new Date(now)
    since.setDate(now.getDate() - 90)

    const campaignIds = metaCampaigns.map((c: any) => c.id).join(',')
    let insightsMap: Record<string, any> = {}

    if (campaignIds) {
      const insightsRes = await fetch(
        `${GRAPH_API}/act_${adAccountId}/insights?fields=campaign_id,impressions,clicks,spend,actions,action_values&level=campaign&time_range={'since':'${since.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}','until':'${now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}'}&access_token=${accessToken}`
      )
      const insightsData = await insightsRes.json()
      if (insightsData.data) {
        for (const insight of insightsData.data) {
          insightsMap[insight.campaign_id] = insight
        }
      }
    }

    const enriched = metaCampaigns.map((c: any) => {
      const insight = insightsMap[c.id]
      const purchases = insight?.actions?.find((a: any) => a.action_type === 'purchase')
      return {
        campaign_id: c.id,
        name: c.name,
        status: c.status,
        effective_status: c.effective_status || c.status,
        sync_enabled: true,
        daily_budget: c.daily_budget ? parseInt(c.daily_budget) : null,
        lifetime_budget: c.lifetime_budget ? parseInt(c.lifetime_budget) : null,
        objective: c.objective || null,
        stats: {
          spend: parseFloat(insight?.spend || '0'),
          clicks: parseInt(insight?.clicks || '0'),
          impressions: parseInt(insight?.impressions || '0'),
          conversions: purchases ? parseInt(purchases.value || '0') : 0,
          conversion_value: 0,
        },
      }
    })

    return NextResponse.json({ campaigns: enriched })
  } catch (err) {
    console.error('[Campaigns List] Meta API fallback error:', err)
    return NextResponse.json({ campaigns: [] })
  }
}
