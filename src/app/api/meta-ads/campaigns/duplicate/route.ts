import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getDecryptedToken } from '@/lib/meta-oauth'
import { requireProPlan } from '@/lib/subscription'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

interface CampaignDetails {
  name: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  bid_strategy?: string
  special_ad_categories?: string[]
}

interface AdSetData {
  id: string
  name: string
  optimization_goal: string
  billing_event: string
  bid_strategy?: string
  bid_amount?: number
  daily_budget?: string
  lifetime_budget?: string
  start_time?: string
  end_time?: string
  targeting?: Record<string, unknown>
}

interface AdData {
  id: string
  name: string
  creative?: { id: string }
}

async function fetchCampaignDetails(accessToken: string, campaignId: string): Promise<CampaignDetails & { error?: { message: string } }> {
  const res = await fetch(
    `${GRAPH_API}/${campaignId}?fields=name,objective,daily_budget,lifetime_budget,bid_strategy,special_ad_categories,buying_type&access_token=${accessToken}`
  )
  return res.json()
}

async function fetchAdSets(accessToken: string, campaignId: string): Promise<AdSetData[]> {
  const res = await fetch(
    `${GRAPH_API}/${campaignId}/adsets?fields=name,status,optimization_goal,billing_event,bid_strategy,bid_amount,daily_budget,lifetime_budget,start_time,end_time,targeting&limit=100&access_token=${accessToken}`
  )
  const data = await res.json()
  return data.data || []
}

async function fetchAds(accessToken: string, adSetId: string): Promise<AdData[]> {
  const res = await fetch(
    `${GRAPH_API}/${adSetId}/ads?fields=name,status,creative&limit=100&access_token=${accessToken}`
  )
  const data = await res.json()
  return data.data || []
}

async function createCampaign(accessToken: string, accountId: string, details: CampaignDetails, campaignName: string, startPaused: boolean) {
  const body: Record<string, string> = {
    name: campaignName,
    objective: details.objective,
    status: startPaused ? 'PAUSED' : 'ACTIVE',
    special_ad_categories: JSON.stringify(details.special_ad_categories || []),
    access_token: accessToken,
  }
  if (details.daily_budget) body.daily_budget = details.daily_budget
  if (details.lifetime_budget) body.lifetime_budget = details.lifetime_budget
  if (details.bid_strategy) body.bid_strategy = details.bid_strategy

  const res = await fetch(`${GRAPH_API}/act_${accountId}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function createAdSet(accessToken: string, accountId: string, campaignId: string, adSet: AdSetData, startPaused: boolean) {
  const body: Record<string, string | number | boolean> = {
    campaign_id: campaignId,
    name: adSet.name,
    status: startPaused ? 'PAUSED' : 'ACTIVE',
    optimization_goal: adSet.optimization_goal,
    billing_event: adSet.billing_event,
    targeting: JSON.stringify(adSet.targeting || {}),
    access_token: accessToken,
  }
  if (adSet.bid_strategy) body.bid_strategy = adSet.bid_strategy
  if (adSet.bid_amount) body.bid_amount = adSet.bid_amount
  if (adSet.daily_budget) body.daily_budget = adSet.daily_budget
  if (adSet.lifetime_budget) body.lifetime_budget = adSet.lifetime_budget
  if (adSet.start_time) body.start_time = adSet.start_time
  if (adSet.end_time) body.end_time = adSet.end_time

  const res = await fetch(`${GRAPH_API}/act_${accountId}/adsets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function createAd(accessToken: string, accountId: string, adSetId: string, ad: AdData, startPaused: boolean) {
  const body: Record<string, string | boolean> = {
    adset_id: adSetId,
    name: ad.name,
    status: startPaused ? 'PAUSED' : 'ACTIVE',
    creative: JSON.stringify({ creative_id: ad.creative?.id }),
    access_token: accessToken,
  }

  const res = await fetch(`${GRAPH_API}/act_${accountId}/ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function copyOneCampaign(
  sourceToken: string,
  targetToken: string,
  sourceAccountId: string,
  targetAccountId: string,
  sourceCampaignId: string,
  campaignDetails: CampaignDetails,
  copyIndex: number,
  startPaused: boolean,
  nameSuffix: string,
  copyAdSets: boolean,
  copyAds: boolean,
) {
  const copyNum = copyIndex + 1
  const suffix = nameSuffix ? `${nameSuffix} ${copyNum}` : `Copia ${copyNum}`
  const campaignName = `${campaignDetails.name} - ${suffix}`

  const newCampaign = await createCampaign(targetToken, targetAccountId, campaignDetails, campaignName, startPaused)
  if (newCampaign.error) {
    return { campaign: { error: newCampaign.error.message }, ad_sets: [], ads: [] }
  }

  const result: { campaign: { id: string; name: string }; ad_sets: Array<{ id?: string; name: string; error?: string }>; ads: Array<{ id?: string; name: string; error?: string }> } = {
    campaign: { id: newCampaign.id, name: campaignName },
    ad_sets: [],
    ads: [],
  }

  if (copyAdSets) {
    const adSets = await fetchAdSets(sourceToken, sourceCampaignId)
    for (const adSet of adSets) {
      const newAdSet = await createAdSet(targetToken, targetAccountId, newCampaign.id, adSet, startPaused)
      if (newAdSet.error) {
        result.ad_sets.push({ name: adSet.name, error: newAdSet.error.message })
        continue
      }
      result.ad_sets.push({ id: newAdSet.id, name: adSet.name })

      if (copyAds) {
        const ads = await fetchAds(sourceToken, adSet.id)
        for (const ad of ads) {
          const newAd = await createAd(targetToken, targetAccountId, newAdSet.id, ad, startPaused)
          if (newAd.error) {
            result.ads.push({ name: ad.name, error: newAd.error.message })
            continue
          }
          result.ads.push({ id: newAd.id, name: ad.name })
        }
      }
      await new Promise(r => setTimeout(r, 200))
    }
  }

  return result
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { await requireProPlan(user.id) } catch {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const body = await req.json()
  const {
    source_campaign_id,
    source_ad_account_id,
    target_ad_account_id,
    name_suffix,
    copy_ad_sets,
    copy_ads,
    start_paused,
    quantity,
  } = body

  if (!source_campaign_id || !source_ad_account_id) {
    return NextResponse.json({ error: 'source_campaign_id and source_ad_account_id required' }, { status: 400 })
  }

  const finalTargetAccountId = target_ad_account_id || source_ad_account_id
  const copies = Math.min(Math.max(Number(quantity) || 1, 1), 20)

  const sourceToken = await getDecryptedToken(source_ad_account_id, user.id)
  if (!sourceToken) return NextResponse.json({ error: 'Source token not found' }, { status: 404 })

  const targetToken = source_ad_account_id === finalTargetAccountId
    ? sourceToken
    : await getDecryptedToken(finalTargetAccountId, user.id)

  if (!targetToken) return NextResponse.json({ error: 'Target token not found' }, { status: 404 })

  const { data: sourceAccount } = await supabase
    .from('ad_accounts').select('id').eq('ad_account_id', source_ad_account_id).eq('user_id', user.id).single()
  if (!sourceAccount) return NextResponse.json({ error: 'Source account not found' }, { status: 404 })

  if (finalTargetAccountId !== source_ad_account_id) {
    const { data: targetAccount } = await supabase
      .from('ad_accounts').select('id').eq('ad_account_id', finalTargetAccountId).eq('user_id', user.id).single()
    if (!targetAccount) return NextResponse.json({ error: 'Target account not found' }, { status: 404 })
  }

  try {
    const campaignDetails = await fetchCampaignDetails(sourceToken, source_campaign_id)
    if (campaignDetails.error) {
      return NextResponse.json({ error: campaignDetails.error.message }, { status: 500 })
    }

    const results: Array<{ copy: number; result: Awaited<ReturnType<typeof copyOneCampaign>> }> = []

    for (let i = 0; i < copies; i++) {
      const result = await copyOneCampaign(
        sourceToken,
        targetToken,
        source_ad_account_id,
        finalTargetAccountId,
        source_campaign_id,
        campaignDetails,
        i,
        start_paused ?? true,
        name_suffix || '',
        copy_ad_sets !== false,
        copy_ads !== false,
      )
      results.push({ copy: i + 1, result })
      if (i < copies - 1) await new Promise(r => setTimeout(r, 500))
    }

    return NextResponse.json({ success: true, copies, results })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
