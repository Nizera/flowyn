import { createAdminClient } from '@/utils/supabase/admin'
import { decryptApiKey, encryptApiKey } from '@/lib/encryption'

const META_APP_ID = process.env.META_APP_ID || ''
const META_APP_SECRET = process.env.META_APP_SECRET || ''
const META_REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/meta-ads/callback`
  : 'https://flowyn.com.br/api/meta-ads/callback'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

export function getMetaOAuthUrl(userId: string): string {
  const scopes = [
    'ads_management',
    'ads_read',
    'business_management',
  ].join(',')

  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    state: userId,
    scope: scopes,
    response_type: 'code',
  })

  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  token_type: string
  expires_in: number
} | null> {
  try {
    const params = new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      redirect_uri: META_REDIRECT_URI,
      code,
    })

    const res = await fetch(`${GRAPH_API}/oauth/access_token?${params.toString()}`)
    const data = await res.json()

    if (data.error) {
      console.error('[Meta OAuth] Token exchange error:', data.error.message)
      return null
    }

    return data
  } catch (error) {
    console.error('[Meta OAuth] Token exchange failed:', error)
    return null
  }
}

export async function getLongLivedToken(shortToken: string): Promise<{
  access_token: string
  token_type: string
  expires_in: number
} | null> {
  try {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      fb_exchange_token: shortToken,
    })

    const res = await fetch(`${GRAPH_API}/oauth/access_token?${params.toString()}`)
    const data = await res.json()

    if (data.error) {
      console.error('[Meta OAuth] Long-lived token error:', data.error.message)
      return null
    }

    return data
  } catch (error) {
    console.error('[Meta OAuth] Long-lived token failed:', error)
    return null
  }
}

export async function getAdAccounts(accessToken: string): Promise<{
  id: string
  name: string
  account_id: string
}[] | null> {
  try {
    const params = new URLSearchParams({
      fields: 'id,name,account_id',
      limit: '100',
    })

    const res = await fetch(`${GRAPH_API}/me/adaccounts?${params.toString()}&access_token=${accessToken}`)
    const data = await res.json()

    if (data.error) {
      console.error('[Meta OAuth] Get ad accounts error:', data.error.message)
      return null
    }

    return data.data || []
  } catch (error) {
    console.error('[Meta OAuth] Get ad accounts failed:', error)
    return null
  }
}

export async function saveAdAccount(
  userId: string,
  adAccountId: string,
  adAccountName: string,
  accessToken: string,
  pixelId?: string,
) {
  const supabase = createAdminClient()
  const encryptedToken = encryptApiKey(accessToken)

  const { error } = await supabase
    .from('ad_accounts')
    .upsert({
      user_id: userId,
      platform: 'meta',
      ad_account_id: adAccountId,
      ad_account_name: adAccountName,
      access_token: encryptedToken,
      pixel_id: pixelId || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform,ad_account_id' })

  if (error) {
    console.error('[Meta OAuth] Save ad account error:', error.message)
    return false
  }

  return true
}

export async function getDecryptedToken(adAccountId: string, userId: string): Promise<string | null> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('ad_accounts')
    .select('access_token')
    .eq('ad_account_id', adAccountId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (!data?.access_token) return null

  try {
    return decryptApiKey(data.access_token)
  } catch {
    return null
  }
}