import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

/**
 * GET /api/meta-ads/diagnostics
 * Diagnosticam vendas não rastreadas por campanha.
 *
 * Query params:
 *   ?start_date=YYYY-MM-DD  (default: 7 dias atrás)
 *   ?end_date=YYYY-MM-DD    (default: hoje)
 *   ?campaign_id=TEXT        (opcional, filtra por campanha específica)
 *
 * Retorna:
 *   - total_orders: total de pedidos no período
 *   - tracked_orders: pedidos com tracking_params completo (UTMs presentes)
 *   - untracked_orders: pedidos sem ou com tracking_params incompleto
 *   - untracked_list: lista detalhada dos não rastreados com motivo
 *   - by_campaign: diagnóstico por campanha (quando sem campaign_id filtro)
 *   - recommendations: sugestões baseadas nos problemas encontrados
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { searchParams } = new URL(req.url)

  const endDate = searchParams.get('end_date') || new Date().toISOString().slice(0, 10)
  const startDate = searchParams.get('start_date') || (() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })()
  const campaignIdFilter = searchParams.get('campaign_id')

  // 1. Buscar todos os pedidos do período
  const { data: orders } = await admin
    .from('orders')
    .select('id, amount, net_value, status, tracking_params, customer_name, created_at, product_id')
    .gte('created_at', startDate + 'T00:00:00')
    .lte('created_at', endDate + 'T23:59:59')
    .order('created_at', { ascending: false })

  if (!orders || orders.length === 0) {
    return NextResponse.json({
      total_orders: 0,
      tracked_orders: 0,
      untracked_orders: 0,
      untracked_list: [],
      by_campaign: [],
      recommendations: [],
    })
  }

  // 2. Buscar campanhas do produtor
  const { data: campaigns } = await admin
    .from('campaigns')
    .select('campaign_id, name, sync_enabled')
    .eq('user_id', user.id)

  const campaignMap = new Map<string, string>()
  for (const c of campaigns || []) {
    campaignMap.set(c.campaign_id, c.name)
  }

  // 3. Classificar pedidos como tracked/untracked
  const tracked: typeof orders = []
  const untracked: Array<{
    order_id: string
    amount: number
    status: string
    customer_name: string
    created_at: string
    reason: string
    reason_detail: string
    has_tracking_params: boolean
    tracking_params_sample: Record<string, string> | null
  }> = []

  for (const order of orders) {
    const tp = order.tracking_params as Record<string, string> | null

    if (isFullyTracked(tp)) {
      tracked.push(order)
    } else {
      const { reason, detail } = diagnoseProblem(tp)
      untracked.push({
        order_id: order.id,
        amount: parseFloat(order.amount) || 0,
        status: order.status || 'unknown',
        customer_name: order.customer_name || '',
        created_at: order.created_at,
        reason,
        reason_detail: detail,
        has_tracking_params: tp !== null,
        tracking_params_sample: tp,
      })
    }
  }

  // 4. Diagnosticar por campanha
  const byCampaign = new Map<string, {
    campaign_name: string
    tracked: number
    untracked: number
    total_revenue: number
    untracked_revenue: number
    top_reasons: Map<string, number>
  }>()

  // Inicializar com todas as campanhas
  for (const c of campaigns || []) {
    if (campaignIdFilter && c.campaign_id !== campaignIdFilter) continue
    byCampaign.set(c.campaign_id, {
      campaign_name: c.name,
      tracked: 0,
      untracked: 0,
      total_revenue: 0,
      untracked_revenue: 0,
      top_reasons: new Map(),
    })
  }

  // Classificar pedidos por campanha
  for (const order of orders) {
    const tp = order.tracking_params as Record<string, string> | null
    const matchedCampaign = matchOrderToCampaign(tp, campaignMap)

    if (matchedCampaign) {
      if (campaignIdFilter && matchedCampaign !== campaignIdFilter) continue
      const camp = byCampaign.get(matchedCampaign)
      if (!camp) continue

      const amount = parseFloat(order.amount) || 0
      camp.total_revenue += amount

      if (isFullyTracked(tp)) {
        camp.tracked++
      } else {
        camp.untracked++
        camp.untracked_revenue += amount
        const { reason } = diagnoseProblem(tp)
        camp.top_reasons.set(reason, (camp.top_reasons.get(reason) || 0) + 1)
      }
    }
  }

  // Converter byCampaign para array
  const byCampaignArray = Array.from(byCampaign.entries()).map(([id, data]) => ({
    campaign_id: id,
    campaign_name: data.campaign_name,
    tracked: data.tracked,
    untracked: data.untracked,
    total_revenue: data.total_revenue,
    untracked_revenue: data.untracked_revenue,
    tracking_rate: data.tracked + data.untracked > 0
      ? Math.round((data.tracked / (data.tracked + data.untracked)) * 100)
      : 0,
    top_reasons: Array.from(data.top_reasons.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count })),
  })).sort((a, b) => b.untracked - a.untracked)

  // 5. Gerar recomendações
  const recommendations = generateRecommendations(untracked, byCampaignArray)

  return NextResponse.json({
    total_orders: orders.length,
    tracked_orders: tracked.length,
    untracked_orders: untracked.length,
    tracking_rate: orders.length > 0
      ? Math.round((tracked.length / orders.length) * 100)
      : 100,
    untracked_list: untracked.slice(0, 50), // Limitar a 50 para não sobrecarregar
    by_campaign: byCampaignArray,
    recommendations,
    period: { start_date: startDate, end_date: endDate },
  })
}

function isFullyTracked(tp: Record<string, string> | null): boolean {
  if (!tp) return false
  const hasUtm = !!(tp.utm_source || tp.utm_medium || tp.utm_campaign || tp.src)
  const hasClickId = !!(tp.fbclid || tp.gclid || tp.ttclid || tp._fbc)
  return hasUtm || hasClickId
}

function diagnoseProblem(tp: Record<string, string> | null): { reason: string; detail: string } {
  if (!tp) {
    return {
      reason: 'Sem tracking_params',
      detail: 'O pedido não possui dados de rastreamento. O checkout não recebeu UTMs.',
    }
  }

  const keys = Object.keys(tp)
  if (keys.length === 0) {
    return {
      reason: 'tracking_params vazio',
      detail: 'O checkout recebeu um objeto vazio de rastreamento.',
    }
  }

  if (keys.length === 1 && tp.fl_sid) {
    return {
      reason: 'Apenas session ID',
      detail: 'Apenas o ID de sessão (fl_sid) foi capturado. UTMs e click IDs não chegaram ao checkout.',
    }
  }

  if (tp.fl_sid && !tp.utm_source && !tp.utm_campaign && !tp.fbclid) {
    return {
      reason: 'Session ID sem UTMs',
      detail: 'A sessão foi registrada mas os parâmetros UTM e click IDs não foram preservados.',
    }
  }

  return {
    reason: 'Tracking parcial',
    detail: `Campos presentes: ${keys.join(', ')}. Faltam campos importantes para atribuição.`,
  }
}

function matchOrderToCampaign(
  tp: Record<string, string> | null,
  campaignMap: Map<string, string>
): string | null {
  if (!tp) return null

  // Match por utm_campaign → campaign_id
  if (tp.utm_campaign && campaignMap.has(tp.utm_campaign)) {
    return tp.utm_campaign
  }

  // Match por utm_campaign → campaign name (case-insensitive)
  if (tp.utm_campaign) {
    const lower = tp.utm_campaign.toLowerCase()
    for (const [id, name] of campaignMap) {
      if (name.toLowerCase() === lower) return id
    }
  }

  // Match por src → campaign name
  if (tp.src) {
    const lower = tp.src.toLowerCase()
    for (const [id, name] of campaignMap) {
      if (name.toLowerCase() === lower) return id
    }
  }

  // Fallback: fbclid/_fbc presente → primeira campanha Meta ativa
  if (tp.fbclid || tp._fbc) {
    const first = campaignMap.keys().next().value
    return first || null
  }

  return null
}

function generateRecommendations(
  untracked: Array<{ reason: string }>,
  byCampaign: Array<{ campaign_name: string; untracked: number; tracking_rate: number }>
): Array<{ type: 'error' | 'warning' | 'info'; title: string; description: string }> {
  const recs: Array<{ type: 'error' | 'warning' | 'info'; title: string; description: string }> = []

  if (untracked.length === 0) {
    recs.push({
      type: 'info',
      title: 'Tudo rastreado!',
      description: 'Todos os pedidos do período possuem dados de rastreamento completos.',
    })
    return recs
  }

  // Contar motivos
  const reasonCounts = new Map<string, number>()
  for (const u of untracked) {
    reasonCounts.set(u.reason, (reasonCounts.get(u.reason) || 0) + 1)
  }

  if (reasonCounts.has('Sem tracking_params') || reasonCounts.has('tracking_params vazio')) {
    recs.push({
      type: 'error',
      title: 'Script de UTM ausente',
      description: `${reasonCounts.get('Sem tracking_params') || 0} pedidos sem dados de rastreamento. Adicione o script de UTM na sua landing page.`,
    })
  }

  if (reasonCounts.has('Apenas session ID') || reasonCounts.has('Session ID sem UTMs')) {
    recs.push({
      type: 'warning',
      title: 'UTMs não preservadas no cross-domain',
      description: 'A sessão foi registrada mas as UTMs não chegaram ao checkout. Verifique se o tracker.js ou o script de UTM está funcionando na landing page.',
    })
  }

  const lowTracking = byCampaign.filter(c => c.tracking_rate < 50 && c.untracked > 0)
  if (lowTracking.length > 0) {
    recs.push({
      type: 'warning',
      title: 'Campanhas com baixo rastreamento',
      description: `${lowTracking.length} campanha(s) com menos de 50% de vendas rastreadas: ${lowTracking.map(c => c.campaign_name).join(', ')}.`,
    })
  }

  return recs
}
