import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { verifyOrigin } from '@/lib/csrf'

export async function POST(req: NextRequest) {
  const csrfError = verifyOrigin(req)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const adAccountId = body.ad_account_id as string | undefined
  if (!adAccountId) return NextResponse.json({ error: 'ad_account_id required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: account } = await admin
    .from('ad_accounts')
    .select('id')
    .eq('ad_account_id', adAccountId)
    .eq('user_id', user.id)
    .single()

  if (!account) return NextResponse.json({ error: 'Conta nao encontrada' }, { status: 404 })

  const tables = [
    'campaigns', 'campaign_insights', 'ad_sets', 'ads',
    'ad_insights', 'ad_insights_cache', 'custom_rules', 'sync_logs'
  ]
  for (const table of tables) {
    await admin.from(table).delete().eq('ad_account_id', adAccountId)
  }

  const { error } = await admin
    .from('ad_accounts')
    .delete()
    .eq('id', account.id)

  if (error) return NextResponse.json({ error: 'Erro ao desconectar conta.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
