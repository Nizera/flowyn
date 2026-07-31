import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDecryptedTokenForSetup } from '@/lib/meta-oauth'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: existingAccounts } = await admin
    .from('ad_accounts')
    .select('ad_account_id, ad_account_name, sync_enabled')
    .eq('user_id', user.id)

  const accessToken = await getDecryptedTokenForSetup(user.id)
  if (!accessToken) {
    return NextResponse.json({ accounts: [], existing: existingAccounts || [] })
  }

  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=account_id,name&access_token=${accessToken}`
    )
    const metaData = await metaRes.json()

    if (metaData.error) {
      console.error('[Meta Setup] Graph API error:', metaData.error.message)
      return NextResponse.json({ accounts: [], existing: existingAccounts || [] })
    }

    const metaAccounts = (metaData.data || []).map((acc: { account_id: string; name: string }) => ({
      account_id: acc.account_id,
      name: acc.name,
    }))

    return NextResponse.json({ accounts: metaAccounts, existing: existingAccounts || [] })
  } catch (error) {
    console.error('[Meta Setup] Failed to fetch ad accounts:', error)
    return NextResponse.json({ accounts: [], existing: existingAccounts || [] })
  }
}
