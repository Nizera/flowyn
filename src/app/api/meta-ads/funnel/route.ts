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
  const startDate = searchParams.get('start_date') || `${new Date().getFullYear()}-01-01`
  const endDate = searchParams.get('end_date') || new Date().toISOString().slice(0, 10)
  const adAccountId = searchParams.get('ad_account_id')

  // 1. Get user's owned ad accounts
  let accountsQuery = supabase
    .from('ad_accounts')
    .select('ad_account_id')
    .eq('user_id', user.id)

  if (adAccountId) {
    accountsQuery = accountsQuery.eq('ad_account_id', adAccountId)
  }

  const { data: ownedAccounts } = await accountsQuery
  const ownedAccountIds = (ownedAccounts || []).map((a: any) => a.ad_account_id)

  if (ownedAccountIds.length === 0) {
    return NextResponse.json({
      stages: [
        { name: 'Cliques', value: 0, color: '#3b82f6' },
        { name: 'Vis. Pagina', value: 0, color: '#6366f1' },
        { name: 'Initiate Checkout', value: 0, color: '#8b5cf6' },
        { name: 'Vendas Iniciadas', value: 0, color: '#a78bfa' },
        { name: 'Vendas Aprovadas', value: 0, color: '#10b981' },
      ],
      conversion_rates: [],
      period: { start_date: startDate, end_date: endDate },
    })
  }

  // 2. Get total clicks from ad_insights_cache (campaign level)
  let insightsQuery = supabase
    .from('ad_insights_cache')
    .select('clicks')
    .eq('insight_level', 'campaign')
    .gte('date', startDate)
    .lte('date', endDate)
    .in('ad_account_id', ownedAccountIds)

  const { data: insights } = await insightsQuery
  const totalClicks = (insights || []).reduce((sum: number, i: any) => sum + (i.clicks || 0), 0)

  // 3. Get user's products
  const { data: products } = await supabase
    .from('products')
    .select('id')
    .eq('owner_id', user.id)
  const productIds = (products || []).map((p: any) => p.id)

  if (productIds.length === 0) {
    return NextResponse.json({
      stages: [
        { name: 'Cliques', value: totalClicks, color: '#3b82f6' },
        { name: 'Vis. Pagina', value: 0, color: '#6366f1' },
        { name: 'Initiate Checkout', value: 0, color: '#8b5cf6' },
        { name: 'Vendas Iniciadas', value: 0, color: '#a78bfa' },
        { name: 'Vendas Aprovadas', value: 0, color: '#10b981' },
      ],
      conversion_rates: [],
      period: { start_date: startDate, end_date: endDate },
    })
  }

  // 4. Get funnel_events counts (page_view, initiate_checkout)
  const startDateTs = `${startDate}T00:00:00`
  const endDateTs = `${endDate}T23:59:59`

  const { count: pageViewsCount } = await supabase
    .from('funnel_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', 'page_view')
    .in('product_id', productIds)
    .gte('created_at', startDateTs)
    .lte('created_at', endDateTs)

  const { count: initiateCheckoutsCount } = await supabase
    .from('funnel_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', 'initiate_checkout')
    .in('product_id', productIds)
    .gte('created_at', startDateTs)
    .lte('created_at', endDateTs)

  const pageViews = pageViewsCount || 0
  const initiateCheckouts = initiateCheckoutsCount || 0

  // 5. Get orders count (pending + paid = sales_initiated, only paid = sales_approved)
  const { count: initiatedCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('product_id', productIds)
    .in('status', ['pending', 'paid'])
    .gte('created_at', startDateTs)
    .lte('created_at', endDateTs)

  const { count: approvedCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('product_id', productIds)
    .eq('status', 'paid')
    .gte('created_at', startDateTs)
    .lte('created_at', endDateTs)

  const salesInitiated = initiatedCount || 0
  const salesApproved = approvedCount || 0

  const stages = [
    { name: 'Cliques', value: totalClicks, color: '#3b82f6' },
    { name: 'Vis. Pagina', value: pageViews, color: '#6366f1' },
    { name: 'Initiate Checkout', value: initiateCheckouts, color: '#8b5cf6' },
    { name: 'Vendas Iniciadas', value: salesInitiated, color: '#a78bfa' },
    { name: 'Vendas Aprovadas', value: salesApproved, color: '#10b981' },
  ]

  // 6. Calculate conversion rates between stages
  const conversionRates: { from: string; to: string; rate: number }[] = []
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i]
    const to = stages[i + 1]
    const rate = from.value > 0 ? (to.value / from.value) * 100 : 0
    conversionRates.push({ from: from.name, to: to.name, rate })
  }

  return NextResponse.json({
    stages,
    conversion_rates: conversionRates,
    period: { start_date: startDate, end_date: endDate },
  })
}
