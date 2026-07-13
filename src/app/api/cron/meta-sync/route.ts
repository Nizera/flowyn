import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDecryptedToken } from '@/lib/meta-oauth'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const bypassSecret = searchParams.get('bypass') === 'true'

  // Validate cron secret if not bypassed
  if (!bypassSecret) {
    const authHeader = req.headers.get('Authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()

  // Retrieve all active ad accounts
  const { data: adAccounts, error: adAccountsError } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('is_active', true)

  if (adAccountsError) {
    console.error('[Meta Sync Cron] Database error:', adAccountsError.message)
    return NextResponse.json({ error: adAccountsError.message }, { status: 500 })
  }

  if (!adAccounts || adAccounts.length === 0) {
    return NextResponse.json({ message: 'No active connected ad accounts to sync' })
  }

  const results: any[] = []
  let totalApiCalls = 0

  for (const account of adAccounts) {
    const accessToken = await getDecryptedToken(account.ad_account_id, account.user_id)
    if (!accessToken) {
      results.push({ account_id: account.ad_account_id, error: 'Token decryption failed' })
      continue
    }

    try {
      // 1. Fetch campaigns (1 API call)
      const campaignsRes = await fetch(
        `${GRAPH_API}/act_${account.ad_account_id}/campaigns?fields=id,name,status&limit=10&access_token=${accessToken}`
      )
      totalApiCalls++
      const campaignsData = await campaignsRes.json()

      if (campaignsData.error) {
        results.push({ account_id: account.ad_account_id, error: campaignsData.error.message })
        continue
      }

      const campaigns = campaignsData.data || []
      const campaignSyncResults: any[] = []

      // 2. Fetch daily insights for each campaign and upsert into ad_insights_cache
      const campaignsToSync = campaigns.slice(0, 5)
      for (const campaign of campaignsToSync) {
        const insightsRes = await fetch(
          `${GRAPH_API}/${campaign.id}/insights?fields=impressions,clicks,spend,ctr,cpc,cpm,reach,actions,action_values&time_increment=1&time_range={'since':'2026-01-01','until':'2026-12-31'}&access_token=${accessToken}`
        )
        totalApiCalls++
        const insightsData = await insightsRes.json()

        if (insightsData.data && insightsData.data.length > 0) {
          for (const row of insightsData.data) {
            const leads = row.actions
              ? row.actions.find((a: any) => a.action_type === 'lead')?.value || 0
              : 0

            await supabase.from('ad_insights_cache').upsert(
              {
                ad_account_id: account.ad_account_id,
                campaign_id: campaign.id,
                campaign_name: campaign.name,
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
          }
        }

        campaignSyncResults.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          insights_rows: insightsData.data?.length || 0,
        })
      }

      // 3. Update last sync timestamp on the database
      await supabase
        .from('ad_accounts')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', account.id)

      results.push({
        account_id: account.ad_account_id,
        account_name: account.ad_account_name,
        campaigns_synced: campaignsToSync.length,
        campaigns: campaignSyncResults,
      })
    } catch (err: any) {
      results.push({ account_id: account.ad_account_id, error: err.message })
    }
  }

  return NextResponse.json({
    success: true,
    sync_time: new Date().toISOString(),
    api_calls_made: totalApiCalls,
    results,
  })
}
