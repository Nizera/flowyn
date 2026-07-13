import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDecryptedToken } from '@/lib/meta-oauth'
import { requireProPlan } from '@/lib/subscription'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

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
  const { ids, action, ad_account_id, level } = body

  if (!ids || !Array.isArray(ids) || ids.length === 0 || !action || !ad_account_id || !level) {
    return NextResponse.json({ error: 'ids[], action, ad_account_id, level required' }, { status: 400 })
  }

  if (!['pause', 'resume', 'delete'].includes(action)) {
    return NextResponse.json({ error: 'action must be pause, resume, or delete' }, { status: 400 })
  }

  if (!['campaign', 'adset', 'ad'].includes(level)) {
    return NextResponse.json({ error: 'level must be campaign, adset, or ad' }, { status: 400 })
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
      let metaStatus: string
      let localTable: string
      let localIdField: string

      if (action === 'delete') {
        // Delete from Meta
        const metaRes = await fetch(`${GRAPH_API}/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken }),
        })
        const metaData = await metaRes.json()
        if (metaData.error) {
          errors.push(`${id}: ${metaData.error.message}`)
          continue
        }
        metaStatus = 'DELETED'
      } else {
        // Pause or resume
        metaStatus = action === 'pause' ? 'PAUSED' : 'ACTIVE'
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
      }

      // Update local DB
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

      await adminSupabase
        .from(localTable)
        .update({ status: metaStatus, effective_status: metaStatus, updated_at: new Date().toISOString() })
        .eq(localIdField, id)
        .eq('ad_account_id', ad_account_id)
        .eq('user_id', user.id)

      results.push({ id, status: metaStatus })
    } catch (err: any) {
      errors.push(`${id}: ${err.message}`)
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