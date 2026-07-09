import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getDecryptedToken } from '@/lib/meta-oauth'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

type Campaign = {
  id: string
  name: string
  status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  created_time: string
}

type Insight = {
  impressions: string
  clicks: string
  spend: string
  actions?: { action_type: string; value: string }[]
  ctr: string
  cpc: string
  cpm: string
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const adAccountId = searchParams.get('ad_account_id')

  if (!adAccountId) {
    return NextResponse.json({ error: 'ad_account_id required' }, { status: 400 })
  }

  const accessToken = await getDecryptedToken(adAccountId, user.id)
  if (!accessToken) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  }

  try {
    const campaignsRes = await fetch(
      `${GRAPH_API}/act_${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,created_time&limit=100&access_token=${accessToken}`
    )
    const campaignsData = await campaignsRes.json()

    if (campaignsData.error) {
      return NextResponse.json({ error: campaignsData.error.message }, { status: 500 })
    }

    const campaigns: Campaign[] = campaignsData.data || []

    const campaignIds = campaigns.map(c => c.id).join(',')
    if (!campaignIds) {
      return NextResponse.json({ campaigns: [] })
    }

    const insightsRes = await fetch(
      `${GRAPH_API}/act_${adAccountId}/insights?fields=campaign_id,impressions,clicks,spend,actions,ctr,cpc,cpm&level=campaign&time_range={'since':'2026-01-01','until':'2026-12-31'}&access_token=${accessToken}`
    )
    const insightsData = await insightsRes.json()

    const insightsMap: Record<string, Insight> = {}
    if (insightsData.data) {
      for (const insight of insightsData.data) {
        insightsMap[insight.campaign_id] = insight
      }
    }

    const enrichedCampaigns = campaigns.map(campaign => ({
      ...campaign,
      insights: insightsMap[campaign.id] || null,
    }))

    return NextResponse.json({ campaigns: enrichedCampaigns })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}