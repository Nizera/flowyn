import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDecryptedToken } from '@/lib/meta-oauth'
import { requireProPlan } from '@/lib/subscription'

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

  try {
    await requireProPlan(user.id)
  } catch {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const adAccountId = searchParams.get('ad_account_id')

  // Return list of connected accounts
  if (action === 'accounts') {
    const { data: accounts } = await supabase
      .from('ad_accounts')
      .select('id, ad_account_id, ad_account_name, pixel_id, sync_enabled, last_sync_at, created_at')
      .eq('user_id', user.id)
      .eq('platform', 'meta')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    return NextResponse.json({ accounts: accounts || [] })
  }

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

// POST: Toggle campaign status (pause/resume) via Meta Graph API
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

  const body = await req.json()
  const { campaign_id, ad_account_id, status } = body

  if (!campaign_id || !ad_account_id || !status) {
    return NextResponse.json({ error: 'campaign_id, ad_account_id, status required' }, { status: 400 })
  }

  if (!['ACTIVE', 'PAUSED'].includes(status)) {
    return NextResponse.json({ error: 'status must be ACTIVE or PAUSED' }, { status: 400 })
  }

  // Verify user owns this account
  const { data: account } = await supabase
    .from('ad_accounts')
    .select('id')
    .eq('ad_account_id', ad_account_id)
    .eq('user_id', user.id)
    .single()

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const accessToken = await getDecryptedToken(ad_account_id, user.id)
  if (!accessToken) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  }

  try {
    // Call Meta Graph API to update campaign status
    const metaRes = await fetch(`${GRAPH_API}/${campaign_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, access_token: accessToken }),
    })
    const metaData = await metaRes.json()

    if (metaData.error) {
      return NextResponse.json({ error: metaData.error.message }, { status: 500 })
    }

    // Update local campaigns table
    const adminSupabase = createAdminClient()
    await adminSupabase
      .from('campaigns')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('campaign_id', campaign_id)
      .eq('ad_account_id', ad_account_id)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, campaign_id, status })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}