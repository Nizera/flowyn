import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { exchangeCodeForToken, getLongLivedToken, getAdAccounts, saveAdAccount } from '@/lib/meta-oauth'

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

  const userId = state

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

  for (const account of accounts) {
    await saveAdAccount(
      userId,
      account.account_id,
      account.name,
      accessToken,
    )
  }

  return NextResponse.redirect(
    new URL('/dashboard/ads?success=connected', req.url)
  )
}