import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDecryptedToken } from '@/lib/meta-oauth'
import { requireProPlan } from '@/lib/subscription'
import { GRAPH_API } from '@/lib/meta-graph-api'
import { isValidMetaId } from '@/lib/auto-rules'

const MAX_BULK_IDS = 50

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

  const rawBody = await req.text()
  if (rawBody.length > 65_536) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }
  const body = JSON.parse(rawBody)
  const { ids, action, ad_account_id, level, budget_amount } = body

  if (!ids || !Array.isArray(ids) || ids.length === 0 || !action || !ad_account_id || !level) {
    return NextResponse.json({ error: 'ids[], action, ad_account_id, level required' }, { status: 400 })
  }

  if (ids.length > MAX_BULK_IDS) {
    return NextResponse.json({ error: `Too many IDs. Maximum: ${MAX_BULK_IDS}` }, { status: 400 })
  }

  if (!isValidMetaId(ad_account_id) || !ids.every((id: string) => isValidMetaId(id))) {
    return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 })
  }

  const { data: allowed, error: rlErr } = await supabase.rpc('consume_rate_limit', {
    p_user_id: user.id,
    p_action: 'meta_bulk',
    p_max: 10,
    p_window_seconds: 60,
  })
  if (rlErr || !allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
  }

  if (!['pause', 'resume', 'delete', 'increase_budget', 'decrease_budget', 'set_budget'].includes(action)) {
    return NextResponse.json({ error: 'action must be pause, resume, delete, increase_budget, decrease_budget, or set_budget' }, { status: 400 })
  }

  if (!['campaign', 'adset', 'ad'].includes(level)) {
    return NextResponse.json({ error: 'level must be campaign, adset, or ad' }, { status: 400 })
  }

  if (['increase_budget', 'decrease_budget', 'set_budget'].includes(action)) {
    if (!['campaign', 'adset'].includes(level)) {
      return NextResponse.json({ error: 'Budget actions only support campaign or adset level' }, { status: 400 })
    }
    if (budget_amount === undefined || budget_amount === null) {
      return NextResponse.json({ error: 'budget_amount required for budget actions' }, { status: 400 })
    }
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

  const adminSupabase = createAdminClient()
  const results: any[] = []
  const errors: string[] = []

  // Process in batches to respect rate limits
  for (const id of ids) {
    try {
      let localTable: string
      let localIdField: string

      switch (level) {
        case 'campaign':
          localTable = 'campaigns'
          localIdField = 'campaign_id'
          break
        case 'adset':
          localTable = 'ad_sets'
          localIdField = 'ad_set_id'
          break
        case 'ad':
          localTable = 'ads'
          localIdField = 'ad_id'
          break
        default:
          continue
      }

      if (action === 'delete') {
        const metaRes = await fetch(`${GRAPH_API}/${id}?access_token=${accessToken}`, { method: 'DELETE' })
        const metaData = await metaRes.json()
        if (metaData.error) errors.push(`${id}: ${metaData.error.message}`)

        await adminSupabase.from(localTable).delete().eq(localIdField, id).eq('ad_account_id', ad_account_id).eq('user_id', user.id)
        if (level === 'campaign') {
          const { data: childAdSets } = await adminSupabase.from('ad_sets').select('ad_set_id').eq('campaign_id', id).eq('ad_account_id', ad_account_id)
          const childAdSetIds = (childAdSets || []).map(a => a.ad_set_id)
          if (childAdSetIds.length > 0) {
            await adminSupabase.from('ads').delete().in('ad_set_id', childAdSetIds).eq('ad_account_id', ad_account_id)
          }
          await adminSupabase.from('ad_sets').delete().eq('campaign_id', id).eq('ad_account_id', ad_account_id)
        } else if (level === 'adset') {
          await adminSupabase.from('ads').delete().eq('ad_set_id', id).eq('ad_account_id', ad_account_id)
        }
        results.push({ id, action: 'delete' })

      } else if (action === 'increase_budget' || action === 'decrease_budget' || action === 'set_budget') {
        let metaTargetId = id

        if (level === 'adset') {
          const { data: adSet } = await adminSupabase
            .from('ad_sets').select('campaign_id').eq('ad_set_id', id).eq('ad_account_id', ad_account_id).single()
          if (adSet?.campaign_id) {
            const campaignRes = await fetch(`${GRAPH_API}/${adSet.campaign_id}?fields=is_adset_budget_sharing_enabled,daily_budget,lifetime_budget&access_token=${accessToken}`)
            const campaignData = await campaignRes.json()
            if (campaignData.is_adset_budget_sharing_enabled === true) {
              const hasCampaignBudget = (Number(campaignData.daily_budget) > 0) || (Number(campaignData.lifetime_budget) > 0)
              if (hasCampaignBudget) {
                metaTargetId = adSet.campaign_id
              }
            }
          }
        }

        const localTableBudget = metaTargetId !== id ? 'campaigns' : localTable
        const localIdFieldBudget = metaTargetId !== id ? 'campaign_id' : localIdField

        const { data: currentItem } = await adminSupabase
          .from(localTableBudget).select('daily_budget,lifetime_budget').eq(localIdFieldBudget, metaTargetId).eq('ad_account_id', ad_account_id).single()

        const currentBudget = Number(currentItem?.daily_budget || currentItem?.lifetime_budget || 0)
        const isDaily = !!currentItem?.daily_budget && Number(currentItem.daily_budget) > 0
        const budgetField = isDaily ? 'daily_budget' : 'lifetime_budget'

        let newBudget: number
        if (action === 'set_budget') {
          newBudget = Math.round(Number(budget_amount) * 100)
        } else if (action === 'increase_budget') {
          newBudget = Math.round(currentBudget * (1 + Number(budget_amount) / 100))
        } else {
          newBudget = Math.round(currentBudget * (1 - Number(budget_amount) / 100))
        }
        newBudget = Math.max(newBudget, 100)

        const metaRes = await fetch(`${GRAPH_API}/${metaTargetId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [budgetField]: String(newBudget), access_token: accessToken }),
        })
        const metaData = await metaRes.json()
        if (metaData.error) {
          errors.push(`${id}: ${metaData.error.message}`)
          continue
        }

        await adminSupabase.from(localTableBudget).update({ [budgetField]: newBudget, updated_at: new Date().toISOString() })
          .eq(localIdFieldBudget, metaTargetId).eq('ad_account_id', ad_account_id).eq('user_id', user.id)

        results.push({ id, action: 'budget', new_budget: newBudget, field: budgetField, applied_to: metaTargetId !== id ? 'campaign' : level })

      } else {
        const metaStatus = action === 'pause' ? 'PAUSED' : 'ACTIVE'
        const metaRes = await fetch(`${GRAPH_API}/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: metaStatus, access_token: accessToken }),
        })
        const metaData = await metaRes.json()
        if (metaData.error) {
          errors.push(`${id}: ${metaData.error.message}`)
          continue
        }

        await adminSupabase.from(localTable).update({ status: metaStatus, effective_status: metaStatus, updated_at: new Date().toISOString() })
          .eq(localIdField, id).eq('ad_account_id', ad_account_id).eq('user_id', user.id)

        results.push({ id, status: metaStatus })
      }
    } catch (err) {
      console.error(`[Meta Bulk] Error for ${id}:`, err)
      errors.push(`${id}: operation failed`)
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    failed: errors.length,
    results,
    errors: errors.length > 0 ? errors : undefined,
  })
}