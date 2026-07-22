import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  const today = new Date().toISOString().slice(0, 10)
  const defaultStart = `${new Date().getFullYear()}-01-01`

  const startDate = searchParams.get('start_date') || defaultStart
  const endDate = searchParams.get('end_date') || today
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }
  if (startDate > endDate) {
    return NextResponse.json({ error: 'start_date must be <= end_date' }, { status: 400 })
  }
  const spanDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000
  if (spanDays > 365) {
    return NextResponse.json({ error: 'Date range cannot exceed 365 days' }, { status: 400 })
  }

  const adAccountId = searchParams.get('ad_account_id')
  if (adAccountId && !/^\d+$/.test(adAccountId)) {
    return NextResponse.json({ error: 'Invalid ad_account_id' }, { status: 400 })
  }

  // 1. Get user's owned ad accounts
  let accountsQuery = supabase
    .from('ad_accounts')
    .select('ad_account_id')
    .eq('user_id', user.id)

  if (adAccountId) {
    accountsQuery = accountsQuery.eq('ad_account_id', adAccountId)
  }

  const { data: ownedAccounts } = await accountsQuery
  const ownedAccountIds = (ownedAccounts || []).map((a: { ad_account_id: string }) => a.ad_account_id)

  if (ownedAccountIds.length === 0) {
    return NextResponse.json({
      stages: [
        { name: 'Cliques', value: 0 },
        { name: 'Visita na Página', value: 0 },
        { name: 'Initiate Checkout', value: 0 },
        { name: 'Vendas Iniciadas', value: 0 },
        { name: 'Vendas Aprovadas', value: 0 },
      ],
      conversion_rates: [],
      period: { start_date: startDate, end_date: endDate },
    })
  }

  // 2. Get total clicks from ad_insights_cache (campaign level)
  const insightsQuery = supabase
    .from('ad_insights_cache')
    .select('clicks')
    .eq('insight_level', 'campaign')
    .gte('date', startDate)
    .lte('date', endDate)
    .in('ad_account_id', ownedAccountIds)

  const { data: insights } = await insightsQuery
  const totalClicks = (insights || []).reduce((sum: number, i: { clicks?: number }) => sum + (i.clicks || 0), 0)

  // 3. Get user's products
  const { data: products } = await supabase
    .from('products')
    .select('id')
    .eq('owner_id', user.id)
  const productIds = (products || []).map((p: { id: string }) => p.id)

  if (productIds.length === 0) {
    return NextResponse.json({
      stages: [
        { name: 'Cliques', value: totalClicks },
        { name: 'Visita na Página', value: 0 },
        { name: 'Initiate Checkout', value: 0 },
        { name: 'Vendas Iniciadas', value: 0 },
        { name: 'Vendas Aprovadas', value: 0 },
      ],
      conversion_rates: [],
      period: { start_date: startDate, end_date: endDate },
    })
  }

  // 4. Get funnel_events counts (page_view, initiate_checkout)
  // CORREÇÃO (tracking cross-domain + bug #28/#29):
  // - tracking_external_events agora filtra por product_id (antes filtrava por user_id, inflando métrica)
  // - tracking_external_events filtra session_id NOT IN (sessions que já tiveram funnel_events.page_view
  //   no mesmo período) para evitar dupla contagem (landing externa + checkout Flowyn = mesmo visitor)
  const startDateTs = `${startDate}T00:00:00`
  const endDateTs = `${endDate}T23:59:59`

  const { count: pageViewsCount } = await supabase
    .from('funnel_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', 'page_view')
    .in('product_id', productIds)
    .gte('created_at', startDateTs)
    .lte('created_at', endDateTs)

  // PageView externos (landing do produtor via tracker.js) — filtrados por product_id
  // para não inflar com eventos de outros produtos do mesmo produtor.
  // Para evitar dupla contagem: contamos todos os externos e subtraímos os que
  // já têm page_view correspondente em funnel_events (mesmo session_id).
  const { count: externalPageViewsCount } = await supabase
    .from('tracking_external_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', 'page_view')
    .eq('user_id', user.id)
    .in('product_id', productIds)
    .gte('created_at', startDateTs)
    .lte('created_at', endDateTs)

  // Sessions que já dispararam page_view em funnel_events (checkout Flowyn)
  const { data: checkoutSessions } = await supabase
    .from('funnel_events')
    .select('session_id')
    .eq('event_name', 'page_view')
    .in('product_id', productIds)
    .gte('created_at', startDateTs)
    .lte('created_at', endDateTs)
    .not('session_id', 'is', null)

  const checkoutSessionIds = new Set(
    (checkoutSessions || []).map((s: { session_id: string }) => s.session_id).filter(Boolean)
  )

  // Conta externos sem session_id duplicado no checkout
  let externalUniqueCount = 0
  if (externalPageViewsCount && externalPageViewsCount > 0) {
    const { data: externalEvents } = await supabase
      .from('tracking_external_events')
      .select('session_id')
      .eq('event_name', 'page_view')
      .eq('user_id', user.id)
      .in('product_id', productIds)
      .gte('created_at', startDateTs)
      .lte('created_at', endDateTs)

    externalUniqueCount = (externalEvents || []).filter(
      (e: { session_id: string }) => !e.session_id || !checkoutSessionIds.has(e.session_id)
    ).length
  }

  const { count: initiateCheckoutsCount } = await supabase
    .from('funnel_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', 'initiate_checkout')
    .in('product_id', productIds)
    .gte('created_at', startDateTs)
    .lte('created_at', endDateTs)

  const pageViews = (pageViewsCount || 0) + externalUniqueCount
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
    { name: 'Cliques', value: totalClicks },
    { name: 'Visita na Página', value: pageViews },
    { name: 'Initiate Checkout', value: initiateCheckouts },
    { name: 'Vendas Iniciadas', value: salesInitiated },
    { name: 'Vendas Aprovadas', value: salesApproved },
  ]

  // 6. Calculate conversion rates between adjacent stages
  const conversionRates: { from: string; to: string; rate: number }[] = []
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i]
    const to = stages[i + 1]
    const rate = from.value > 0 ? (to.value / from.value) * 100 : 0
    conversionRates.push({ from: from.name, to: to.name, rate })
  }

  // 7. Add overall conversion (first → last)
  if (stages.length >= 2) {
    const first = stages[0]
    const last = stages[stages.length - 1]
    const overallRate = first.value > 0 ? (last.value / first.value) * 100 : 0
    conversionRates.push({ from: first.name, to: last.name, rate: overallRate })
  }

  return NextResponse.json({
    stages,
    conversion_rates: conversionRates,
    period: { start_date: startDate, end_date: endDate },
  })
}
