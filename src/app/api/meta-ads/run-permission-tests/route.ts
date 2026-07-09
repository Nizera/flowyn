import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getDecryptedToken } from '@/lib/meta-oauth'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get first connected active ad account for this user
  const { data: adAccounts, error: adAccountsError } = await supabase
    .from('ad_accounts')
    .select('ad_account_id, ad_account_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)

  if (adAccountsError) {
    return NextResponse.json({ error: adAccountsError.message }, { status: 500 })
  }

  if (!adAccounts || adAccounts.length === 0) {
    return NextResponse.json({ error: 'No active connected ad accounts found' }, { status: 404 })
  }

  const adAccountId = adAccounts[0].ad_account_id
  const accessToken = await getDecryptedToken(adAccountId, user.id)

  if (!accessToken) {
    return NextResponse.json({ error: 'Access token not found or decryption failed' }, { status: 404 })
  }

  const results: Record<string, any> = {}

  try {
    // 1. public_profile
    try {
      const res = await fetch(`${GRAPH_API}/me?fields=id,name&access_token=${accessToken}`)
      results['public_profile'] = await res.json()
    } catch (err: any) {
      results['public_profile'] = { error: err.message }
    }

    // 2. email
    try {
      const res = await fetch(`${GRAPH_API}/me?fields=email&access_token=${accessToken}`)
      results['email'] = await res.json()
    } catch (err: any) {
      results['email'] = { error: err.message }
    }

    // 3. pages_show_list
    let pageId: string | null = null
    try {
      const res = await fetch(`${GRAPH_API}/me/accounts?access_token=${accessToken}`)
      const data = await res.json()
      results['pages_show_list'] = data
      if (data.data && data.data.length > 0) {
        pageId = data.data[0].id
      }
    } catch (err: any) {
      results['pages_show_list'] = { error: err.message }
    }

    // 4. pages_read_engagement & pages_manage_ads (if page exists)
    if (pageId) {
      try {
        const res = await fetch(`${GRAPH_API}/${pageId}?fields=engagement,followers_count&access_token=${accessToken}`)
        results['pages_read_engagement'] = await res.json()
      } catch (err: any) {
        results['pages_read_engagement'] = { error: err.message }
      }

      try {
        const res = await fetch(`${GRAPH_API}/${pageId}/ads?access_token=${accessToken}`)
        results['pages_manage_ads'] = await res.json()
      } catch (err: any) {
        results['pages_manage_ads'] = { error: err.message }
      }
    } else {
      results['pages_read_engagement'] = { info: 'No pages found to test pages_read_engagement' }
      results['pages_manage_ads'] = { info: 'No pages found to test pages_manage_ads' }
    }

    // 5. business_management
    let businessId: string | null = null
    try {
      const res = await fetch(`${GRAPH_API}/me/businesses?access_token=${accessToken}`)
      const data = await res.json()
      results['business_management'] = data
      if (data.data && data.data.length > 0) {
        businessId = data.data[0].id
      }
    } catch (err: any) {
      results['business_management'] = { error: err.message }
    }

    // 6. Business Asset User Profile Access (if business exists)
    if (businessId) {
      try {
        const res = await fetch(`${GRAPH_API}/${businessId}/business_users?access_token=${accessToken}`)
        results['Business Asset User Profile Access'] = await res.json()
      } catch (err: any) {
        results['Business Asset User Profile Access'] = { error: err.message }
      }
    } else {
      results['Business Asset User Profile Access'] = { info: 'No businesses found to test Business Asset User Profile Access' }
    }

    // 7. ads_read
    try {
      const res = await fetch(`${GRAPH_API}/act_${adAccountId}/campaigns?fields=id,name,status&access_token=${accessToken}`)
      results['ads_read'] = await res.json()
    } catch (err: any) {
      results['ads_read'] = { error: err.message }
    }

    // 8. ads_management (Create a dummy paused campaign)
    try {
      const createRes = await fetch(`${GRAPH_API}/act_${adAccountId}/campaigns?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Flowyn Permission Test',
          objective: 'OUTCOME_SALES',
          status: 'PAUSED',
        }),
      })
      const createData = await createRes.json()
      results['ads_management_create'] = createData

      // Delete if successful
      if (createData.id) {
        await fetch(`${GRAPH_API}/${createData.id}?access_token=${accessToken}`, { method: 'DELETE' })
      }
    } catch (err: any) {
      results['ads_management'] = { error: err.message }
    }

    // 9. catalog_management (Optional test - if they still have catalog permission)
    try {
      const res = await fetch(`${GRAPH_API}/me/owned_product_catalogs?access_token=${accessToken}`)
      results['catalog_management'] = await res.json()
    } catch (err: any) {
      results['catalog_management'] = { error: err.message }
    }

    // 10. threads_business_basic (Optional test - if they still have threads permission)
    try {
      const res = await fetch(`${GRAPH_API}/me/threads_accounts?access_token=${accessToken}`)
      results['threads_business_basic'] = await res.json()
    } catch (err: any) {
      results['threads_business_basic'] = { error: err.message }
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
