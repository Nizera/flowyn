import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDecryptedToken } from '@/lib/meta-oauth'
import { GRAPH_API } from '@/lib/meta-graph-api'
import { verifyOrigin } from '@/lib/csrf'

export async function PATCH(req: NextRequest) {
  const csrfError = verifyOrigin(req)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { campaign_id, ad_account_id, sync_enabled } = body as {
    campaign_id?: string
    ad_account_id?: string
    sync_enabled?: boolean
  }

  if (!campaign_id || !ad_account_id || typeof sync_enabled !== 'boolean') {
    return NextResponse.json({ error: 'campaign_id, ad_account_id and sync_enabled required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Try to find existing campaign
  let { data: campaign } = await admin
    .from('campaigns')
    .select('id, ad_account_id')
    .eq('user_id', user.id)
    .eq('campaign_id', campaign_id)
    .maybeSingle()

  // If not found, fetch real data from Meta API before inserting
  if (!campaign) {
    let name = campaign_id
    let status = 'UNKNOWN'
    let effectiveStatus = 'UNKNOWN'
    let objective = null

    const accessToken = await getDecryptedToken(ad_account_id, user.id)
    if (accessToken) {
      try {
        const metaRes = await fetch(
          `${GRAPH_API}/${campaign_id}?fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget&access_token=${accessToken}`
        )
        const metaData = await metaRes.json()
        if (metaData && !metaData.error) {
          name = metaData.name || campaign_id
          status = metaData.status || 'UNKNOWN'
          effectiveStatus = metaData.effective_status || status
          objective = metaData.objective || null
        }
      } catch {
        // Fallback to placeholder values
      }
    }

    const { data: inserted, error: insertErr } = await admin
      .from('campaigns')
      .upsert({
        user_id: user.id,
        ad_account_id: ad_account_id,
        campaign_id: campaign_id,
        name: name,
        status: status,
        effective_status: effectiveStatus,
        objective: objective,
        sync_enabled: sync_enabled,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,ad_account_id,campaign_id' })
      .select('id, ad_account_id')
      .single()

    if (insertErr) {
      return NextResponse.json({ error: 'Erro ao criar campanha.' }, { status: 500 })
    }
    campaign = inserted
  } else {
    // Update existing campaign
    const { error: updateErr } = await admin
      .from('campaigns')
      .update({ sync_enabled, updated_at: new Date().toISOString() })
      .eq('id', campaign.id)

    if (updateErr) {
      return NextResponse.json({ error: 'Erro ao atualizar campanha.' }, { status: 500 })
    }
  }

  // If disabling, delete cached insights (use verified campaign.ad_account_id, not body's)
  if (!sync_enabled && campaign) {
    await admin
      .from('ad_insights_cache')
      .delete()
      .eq('ad_account_id', campaign.ad_account_id)
      .eq('campaign_id', campaign_id)

    await admin
      .from('campaign_insights')
      .delete()
      .eq('ad_account_id', campaign.ad_account_id)
      .eq('campaign_id', campaign_id)
  }

  return NextResponse.json({ ok: true, campaign_id, sync_enabled })
}
