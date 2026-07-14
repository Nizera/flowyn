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
  const adAccountId = searchParams.get('ad_account_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  if (!adAccountId) {
    return NextResponse.json({ error: 'ad_account_id required' }, { status: 400 })
  }

  // Verify user owns this account
  const { data: account } = await supabase
    .from('ad_accounts')
    .select('id')
    .eq('ad_account_id', adAccountId)
    .eq('user_id', user.id)
    .single()

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Fetch campaigns from local DB
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  // Fetch all insights (campaign, adset, ad level)
  const since = dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const until = dateTo || new Date().toISOString().slice(0, 10)
  const { data: campaignInsights } = await supabase
    .from('ad_insights_cache')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .eq('insight_level', 'campaign')
    .gte('date', since)
    .lte('date', until)

  const { data: adsetInsights } = await supabase
    .from('ad_insights_cache')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .eq('insight_level', 'adset')
    .gte('date', since)
    .lte('date', until)

  const { data: adInsights } = await supabase
    .from('ad_insights_cache')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .eq('insight_level', 'ad')
    .gte('date', since)
    .lte('date', until)

  function reduceInsights(rows: any[]) {
    return rows.reduce((acc: any, curr: any) => ({
      spend: acc.spend + (parseFloat(curr.spend) || 0),
      impressions: acc.impressions + (parseInt(curr.impressions) || 0),
      clicks: acc.clicks + (parseInt(curr.clicks) || 0),
      reach: acc.reach + (parseInt(curr.reach) || 0),
      conversions: acc.conversions + (parseInt(curr.conversions) || 0),
      conversion_value: acc.conversion_value + (parseFloat(curr.conversion_value) || 0),
      cpc: null,
      cpm: null,
      ctr: null,
    }), { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0, cpc: null, cpm: null, ctr: null })
  }

  // Fetch ad sets from local DB
  const { data: adSets } = await supabase
    .from('ad_sets')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  // Fetch ads from local DB
  const { data: ads } = await supabase
    .from('ads')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  // Enrich campaigns
  const enrichedCampaigns = (campaigns || []).map(c => ({
    ...c,
    insights: reduceInsights((campaignInsights || []).filter(i => i.campaign_id === c.campaign_id))
  }))

  // Enrich adsets
  const enrichedAdSets = (adSets || []).map(a => ({
    ...a,
    insights: reduceInsights((adsetInsights || []).filter(i => i.ad_set_id === a.ad_set_id))
  }))

  // Enrich ads
  const enrichedAds = (ads || []).map(a => ({
    ...a,
    insights: reduceInsights((adInsights || []).filter(i => i.ad_id === a.ad_id))
  }))

  return NextResponse.json({
    campaigns: enrichedCampaigns,
    ad_sets: enrichedAdSets,
    ads: enrichedAds,
  })
}