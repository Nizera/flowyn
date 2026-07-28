import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { accounts } = body as {
    accounts: { account_id: string; name: string; sync_enabled: boolean }[]
  }

  if (!Array.isArray(accounts)) {
    return NextResponse.json({ error: 'accounts array required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: existingAccounts } = await admin
    .from('ad_accounts')
    .select('ad_account_id')
    .eq('user_id', user.id)

  const existingIds = new Set((existingAccounts || []).map(a => a.ad_account_id))

  for (const acc of accounts) {
    if (existingIds.has(acc.account_id)) {
      const updateData: Record<string, unknown> = {
        ad_account_name: acc.name,
        sync_enabled: acc.sync_enabled,
        is_active: acc.sync_enabled,
      }

      await admin
        .from('ad_accounts')
        .update(updateData)
        .eq('ad_account_id', acc.account_id)
        .eq('user_id', user.id)
    } else {
      await admin
        .from('ad_accounts')
        .insert({
          user_id: user.id,
          platform: 'meta',
          ad_account_id: acc.account_id,
          ad_account_name: acc.name,
          access_token: null,
          pixel_id: null,
          is_active: true,
          sync_enabled: acc.sync_enabled !== false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
    }
  }

  for (const existing of existingAccounts || []) {
    const inSelection = accounts.find(a => a.account_id === existing.ad_account_id)
    if (!inSelection) {
      await admin
        .from('ad_accounts')
        .update({ sync_enabled: false, is_active: false })
        .eq('ad_account_id', existing.ad_account_id)
        .eq('user_id', user.id)
    }
  }

  return NextResponse.json({ ok: true })
}
