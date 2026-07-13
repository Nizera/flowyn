import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { requireProPlan } from '@/lib/subscription'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireProPlan(user.id)
  } catch {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const adAccountId = searchParams.get('ad_account_id')

  if (!adAccountId) {
    return NextResponse.json({ error: 'ad_account_id required' }, { status: 400 })
  }

  // Verify user owns this account
  const { data: account } = await supabase
    .from('ad_accounts')
    .select('id')
    .eq('ad_account_id', adAccountId)
    .eq('user_id', user.id)
    .single()

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Fetch campaigns from local DB
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  // Fetch ad sets from local DB
  const { data: adSets } = await supabase
    .from('ad_sets')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  // Fetch ads from local DB
  const { data: ads } = await supabase
    .from('ads')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  return NextResponse.json({
    campaigns: campaigns || [],
    ad_sets: adSets || [],
    ads: ads || [],
  })
}