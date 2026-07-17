import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDecryptedToken } from '@/lib/meta-oauth'
import { requireProPlan } from '@/lib/subscription'
import { GRAPH_API } from '@/lib/meta-graph-api'
import { isValidMetaId } from '@/lib/auto-rules'

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
  const { id, ad_account_id, status, level } = body

  if (!id || !ad_account_id || !status || !level) {
    return NextResponse.json({ error: 'id, ad_account_id, status, level required' }, { status: 400 })
  }

  if (!['ACTIVE', 'PAUSED'].includes(status)) {
    return NextResponse.json({ error: 'status must be ACTIVE or PAUSED' }, { status: 400 })
  }

  if (!['campaign', 'adset', 'ad'].includes(level)) {
    return NextResponse.json({ error: 'level must be campaign, adset, or ad' }, { status: 400 })
  }

  if (!isValidMetaId(id) || !isValidMetaId(ad_account_id)) {
    return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 })
  }

  const { data: allowed, error: rlErr } = await supabase.rpc('consume_rate_limit', {
    p_user_id: user.id,
    p_action: 'meta_toggle',
    p_max: 30,
    p_window_seconds: 60,
  })
  if (rlErr || !allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
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
    // Call Meta Graph API to update status
    const metaRes = await fetch(`${GRAPH_API}/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, access_token: accessToken }),
    })
    const metaData = await metaRes.json()

    if (metaData.error) {
      return NextResponse.json({ error: metaData.error.message }, { status: 500 })
    }

    // Update local DB
    const adminSupabase = createAdminClient()
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
        return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
    }

    await adminSupabase
      .from(localTable)
      .update({ status, effective_status: status, updated_at: new Date().toISOString() })
      .eq(localIdField, id)
      .eq('ad_account_id', ad_account_id)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, id, status, level })
  } catch (error) {
    console.error('[Meta Toggle] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}