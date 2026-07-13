import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getDecryptedToken } from '@/lib/meta-oauth'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { ad_account_id } = body

  if (!ad_account_id) {
    return NextResponse.json({ error: 'ad_account_id required' }, { status: 400 })
  }

  // Verify user owns this account
  const { data: account, error: accountError } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('ad_account_id', ad_account_id)
    .eq('user_id', user.id)
    .single()

  if (accountError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const accessToken = await getDecryptedToken(ad_account_id, user.id)
  if (!accessToken) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  }

  try {
    // 1 API call: Fetch campaign-level insights
    const insightsRes = await fetch(
      `${GRAPH_API}/act_${ad_account_id}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach,actions,action_values&level=campaign&time_increment=1&time_range={'since':'2026-01-01','until':'2026-12-31'}&access_token=${accessToken}`
    )
    const insightsData = await insightsRes.json()

    if (insightsData.error) {
      return NextResponse.json({ error: insightsData.error.message }, { status: 500 })
    }

    // Upsert each row into ad_insights_cache
    let rowsSynced = 0
    if (insightsData.data && insightsData.data.length > 0) {
      for (const row of insightsData.data) {
        const leads = row.actions
          ? row.actions.find((a: any) => a.action_type === 'lead')?.value || 0
          : 0

        await supabase.from('ad_insights_cache').upsert(
          {
            ad_account_id: ad_account_id,
            campaign_id: row.campaign_id,
            campaign_name: row.campaign_name,
            spend: parseFloat(row.spend || '0'),
            clicks: parseInt(row.clicks || '0'),
            impressions: parseInt(row.impressions || '0'),
            reach: parseInt(row.reach || '0'),
            leads: parseInt(leads),
            cpc: parseFloat(row.cpc || '0'),
            cpm: parseFloat(row.cpm || '0'),
            ctr: parseFloat(row.ctr || '0'),
            cost_per_lead: leads > 0 ? parseFloat(row.spend || '0') / parseInt(leads) : 0,
            date: row.date_start,
          },
          { onConflict: 'ad_account_id,campaign_id,date' }
        )
        rowsSynced++
      }
    }

    // Update last sync timestamp
    await supabase
      .from('ad_accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', account.id)

    return NextResponse.json({
      success: true,
      account_id: ad_account_id,
      rows_synced: rowsSynced,
      synced_at: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Toggle sync_enabled for an account
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { ad_account_id, sync_enabled } = body

  if (!ad_account_id || sync_enabled === undefined) {
    return NextResponse.json({ error: 'ad_account_id and sync_enabled required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('ad_accounts')
    .update({ sync_enabled })
    .eq('ad_account_id', ad_account_id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, sync_enabled })
}
