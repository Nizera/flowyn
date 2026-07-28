import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: accounts } = await admin
    .from('ad_accounts')
    .select('id, ad_account_id')
    .eq('user_id', user.id)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 })
  }

  const tables = [
    'campaigns', 'campaign_insights', 'ad_sets', 'ads',
    'ad_insights_cache', 'custom_rules', 'sync_logs',
    'campaign_costs', 'order_attributions', 'meta_api_usage'
  ]

  for (const acct of accounts) {
    for (const table of tables) {
      await admin.from(table).delete().eq('ad_account_id', acct.ad_account_id).then(({ error }) => {
        if (error && !/column .* does not exist|relation .* does not exist/i.test(error.message)) {
          console.warn(`[disconnect-all] Error deleting from ${table}:`, error.message)
        }
      })
    }
  }

  const { error } = await admin
    .from('ad_accounts')
    .delete()
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, deleted: accounts.length })
}
