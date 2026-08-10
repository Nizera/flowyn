import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { exchangeCodeForToken, getLongLivedToken, getAdAccounts, verifyOAuthState } from '@/lib/meta-oauth'
import { encryptApiKey } from '@/lib/encryption'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/ads?error=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard/ads?error=missing_params', req.url)
    )
  }

  const userId = verifyOAuthState(state)
  if (!userId) {
    return NextResponse.redirect(
      new URL('/dashboard/ads?error=invalid_state', req.url)
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.id !== userId) {
    return NextResponse.redirect(
      new URL('/login', req.url)
    )
  }

  const tokenData = await exchangeCodeForToken(code)
  if (!tokenData) {
    return NextResponse.redirect(
      new URL('/dashboard/ads?error=token_exchange_failed', req.url)
    )
  }

  const longLivedToken = await getLongLivedToken(tokenData.access_token)
  const accessToken = longLivedToken?.access_token || tokenData.access_token

  const accounts = await getAdAccounts(accessToken)
  if (!accounts || accounts.length === 0) {
    return NextResponse.redirect(
      new URL('/dashboard/ads?error=no_ad_accounts', req.url)
    )
  }

  const admin = createAdminClient()
  const encryptedToken = encryptApiKey(accessToken)

  const insertErrors: string[] = []
  for (const account of accounts) {
    const { data: existing } = await admin
      .from('ad_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('ad_account_id', account.account_id)
      .single()

    if (!existing) {
      const { error } = await admin
        .from('ad_accounts')
        .insert({
          user_id: userId,
          platform: 'meta',
          ad_account_id: account.account_id,
          ad_account_name: account.name,
          access_token: encryptedToken,
          pixel_id: null,
          is_active: true,
          sync_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      if (error) insertErrors.push(`insert ${account.account_id}: ${error.message}`)
    } else {
      const { error } = await admin
        .from('ad_accounts')
        .update({
          access_token: encryptedToken,
          ad_account_name: account.name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (error) insertErrors.push(`update ${account.account_id}: ${error.message}`)
    }
  }

  if (insertErrors.length > 0) {
    console.error('[Meta Callback] Insert errors:', insertErrors)
  }

  return NextResponse.redirect(
    new URL('/dashboard/ads', req.url)
  )
}