import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDecryptedToken } from '@/lib/meta-oauth'
import { requireProPlan } from '@/lib/subscription'
import { GRAPH_API } from '@/lib/meta-graph-api'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { await requireProPlan(user.id) } catch {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const body = await req.json()
  const { id, ad_account_id, level, daily_budget, lifetime_budget } = body

  if (!id || !ad_account_id || !level) {
    return NextResponse.json({ error: 'id, ad_account_id, level required' }, { status: 400 })
  }

  if (!['campaign', 'adset'].includes(level)) {
    return NextResponse.json({ error: 'level must be campaign or adset' }, { status: 400 })
  }

  if (daily_budget === undefined && lifetime_budget === undefined) {
    return NextResponse.json({ error: 'daily_budget or lifetime_budget required' }, { status: 400 })
  }

  const { data: account } = await supabase
    .from('ad_accounts').select('id').eq('ad_account_id', ad_account_id).eq('user_id', user.id).single()
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const accessToken = await getDecryptedToken(ad_account_id, user.id)
  if (!accessToken) return NextResponse.json({ error: 'Token not found' }, { status: 404 })

  const admin = createAdminClient()
  let targetId = id
  let targetLevel = level

  if (level === 'adset') {
    const { data: adSet } = await supabase
      .from('ad_sets').select('campaign_id').eq('ad_set_id', id).eq('ad_account_id', ad_account_id).single()

    if (adSet?.campaign_id) {
      const campaignRes = await fetch(
        `${GRAPH_API}/${adSet.campaign_id}?fields=is_adset_budget_sharing_enabled,daily_budget,lifetime_budget&access_token=${accessToken}`
      )
      const campaignData = await campaignRes.json()

      if (campaignData.is_adset_budget_sharing_enabled === true) {
        const hasCampaignBudget = (Number(campaignData.daily_budget) > 0) || (Number(campaignData.lifetime_budget) > 0)
        if (hasCampaignBudget) {
          targetId = adSet.campaign_id
          targetLevel = 'campaign'
        }
      }
    }
  }

  const updatePayload: Record<string, string | number> = { access_token: accessToken }
  if (daily_budget !== undefined) updatePayload.daily_budget = String(daily_budget)
  if (lifetime_budget !== undefined) updatePayload.lifetime_budget = String(lifetime_budget)

  try {
    const metaRes = await fetch(`${GRAPH_API}/${targetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    })
    const metaData = await metaRes.json()

    if (metaData.error) {
      return NextResponse.json({ error: metaData.error.message }, { status: 500 })
    }

    const localTable = targetLevel === 'campaign' ? 'campaigns' : 'ad_sets'
    const localIdField = targetLevel === 'campaign' ? 'campaign_id' : 'ad_set_id'

    const updateDb: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (daily_budget !== undefined) updateDb.daily_budget = daily_budget
    if (lifetime_budget !== undefined) updateDb.lifetime_budget = lifetime_budget

    await admin.from(localTable).update(updateDb).eq(localIdField, targetId).eq('ad_account_id', ad_account_id).eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      id: targetId,
      level: targetLevel,
      applied_to: targetId !== id ? 'campaign' : level,
      daily_budget,
      lifetime_budget,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
