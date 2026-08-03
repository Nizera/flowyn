'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { BadgeCard } from '@/components/BadgeCard'
import { DashboardFilters } from './DashboardFilters'
import { TrendingUp, CreditCard, CheckCircle, Undo, Clock, AlertCircle, RefreshCw, Unlink } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { currency } from '@/lib/format'
import { KpiSparkline } from './KpiSparkline'

const FunnelChart = dynamic(
  () => import('./FunnelChart').then(m => ({ default: m.FunnelChart })),
  { loading: () => <div className="h-[200px] animate-pulse rounded-xl bg-surface" /> },
)
const RevenueSpendChart = dynamic(
  () => import('./RevenueSpendChart').then(m => ({ default: m.RevenueSpendChart })),
  { loading: () => <div className="h-[300px] animate-pulse rounded-xl bg-surface" /> },
)
const RevenueWaveBackground = dynamic(
  () => import('./RevenueWaveBackground').then(m => ({ default: m.RevenueWaveBackground })),
  { ssr: false, loading: () => null },
)

interface Summary {
  total_revenue: number
  total_spend: number
  total_sales: number
  total_paid: number
  tracked_revenue: number
  tracked_orders: number
  untracked_revenue: number
  untracked_orders: number
  roas: number
  net_profit: number
  total_orders: number
  pending_revenue: number
  refunded_revenue: number
  profit_margin: number
  arpu: number
  chargeback_rate: number
  chargeback_count: number
  chargeback_revenue: number
  total_impressions: number
  total_clicks: number
  aggregate_ctr: number
  aggregate_cpc: number
  aggregate_cpm: number
  total_taxes: number
  total_production_costs: number
  roi: number
}

interface Sale {
  id?: string
  customer_name?: string
  product_name?: string
  amount: number
  status: string
}

interface PaymentBreakdown {
  status: string
  count: number
  total: number
}

interface DashboardData {
  summary: Summary
  recent_sales?: Sale[]
  spend_over_time: Array<{ date: string; spend: number; revenue: number }>
  payment_breakdown?: PaymentBreakdown[]
}

const EMPTY_SUMMARY: Summary = {
  total_revenue: 0, total_spend: 0, total_sales: 0, total_paid: 0,
  tracked_revenue: 0, tracked_orders: 0, untracked_revenue: 0, untracked_orders: 0,
  roas: 0, net_profit: 0, total_orders: 0, pending_revenue: 0, refunded_revenue: 0,
  profit_margin: 0, arpu: 0, chargeback_rate: 0, chargeback_count: 0,
  chargeback_revenue: 0, total_impressions: 0, total_clicks: 0,
  aggregate_ctr: 0, aggregate_cpc: 0, aggregate_cpm: 0,
  total_taxes: 0, total_production_costs: 0, roi: 0,
}

function getDefaultDateRange() {
  const now = new Date()
  const from = new Date(now.getTime() - 7 * 86400000) // Default to 7 days for closer zoom
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
}

const STORAGE_KEY = 'flowyn_dashboard_filters'

function loadPersistedFilters(): { dateRange: { from: string; to: string }; selectedCampaigns: string[] | null } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.dateRange?.from && parsed?.dateRange?.to) return parsed
    return null
  } catch {
    return null
  }
}

function persistFilters(dateRange: { from: string; to: string }, selectedCampaigns: Set<string> | null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      dateRange,
      selectedCampaigns: selectedCampaigns ? Array.from(selectedCampaigns) : null,
    }))
  } catch {}
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)

  const persisted = useMemo(() => loadPersistedFilters(), [])
  const [dateRange, setDateRange] = useState(persisted?.dateRange || getDefaultDateRange)
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string> | null>(
    persisted?.selectedCampaigns ? new Set(persisted.selectedCampaigns) : null
  )
  const [campaigns, setCampaigns] = useState<Array<{ campaign_id: string; name: string }>>([])

  async function handleSyncAllActive() {
    setSyncingAll(true)
    try {
      const resAccounts = await fetch('/api/meta-ads/campaigns?action=accounts')
      const dataAccounts = await resAccounts.json()
      const activeAccounts = (dataAccounts.accounts || []).filter((a: any) => a.sync_enabled !== false)

      for (const acc of activeAccounts) {
        await fetch('/api/meta-ads/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ad_account_id: acc.ad_account_id }),
        })
      }
      window.location.reload()
    } catch (e) {
      console.error('Sync all error:', e)
    } finally {
      setSyncingAll(false)
    }
  }

  // Fetch campaigns for the filter selector
  useEffect(() => {
    fetch('/api/meta-ads/campaigns?action=list')
      .then(async (res) => {
        if (!res.ok) return
        const d = await res.json()
        setCampaigns(d.campaigns || [])
      })
      .catch(() => {})
  }, [])

  // Persist filters to localStorage
  useEffect(() => {
    persistFilters(dateRange, selectedCampaigns)
  }, [dateRange, selectedCampaigns])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      start_date: dateRange.from,
      end_date: dateRange.to,
    })
    if (selectedCampaigns && selectedCampaigns.size > 0) {
      params.set('campaign_ids', Array.from(selectedCampaigns).join(','))
    }
    try {
      const res = await fetch(`/api/meta-ads/dashboard?${params}`)
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/sign-in'
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const d = await res.json()
      setData(d as DashboardData)
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError('Falha ao carregar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [dateRange, selectedCampaigns])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const s = useMemo<Summary>(() => data?.summary || EMPTY_SUMMARY, [data])

  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: string } | null>(null)

  // Sparkline data sampling (Proportional & Monotone Curve Ready)
  const spendOverTime = data?.spend_over_time || []
  
  const getSparklinePoints = (type: 'orders' | 'aov' | 'customers' | 'roas' | 'profit' | 'refunds') => {
    if (spendOverTime.length === 0) return []

    return spendOverTime.map(d => {
      const rev = d.revenue || 0
      const spd = d.spend || 0
      const prof = rev - spd
      
      switch (type) {
        case 'orders':
          return rev > 0 ? Math.max(1, Math.round((rev / (s.total_revenue || 1)) * s.total_orders)) : 0
        case 'aov':
          return spd > 0 ? rev / Math.max(1, Math.round((rev / (s.total_revenue || 1)) * s.total_orders)) : 0
        case 'customers':
          return rev > 0 ? Math.max(1, Math.round((rev / (s.total_revenue || 1)) * s.total_sales)) : 0
        case 'roas':
          return spd > 0 ? rev / spd : 0
        case 'profit':
          return prof
        case 'refunds':
          return Math.max(0, Math.round(rev * (s.refunded_revenue / (s.total_revenue || 1))))
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm text-muted font-medium">Carregando painel...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-rose-500" />
          <p className="text-sm text-foreground font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sync button */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleSyncAllActive}
          disabled={syncingAll}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-sm transition hover:bg-surface disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
          {syncingAll ? 'Sincronizando...' : 'Sincronizar'}
        </button>
      </div>

      {/* Filters */}
      <DashboardFilters
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        selectedCampaigns={selectedCampaigns}
        onCampaignsChange={setSelectedCampaigns}
        campaigns={campaigns}
      />

      {/* Hero Revenue Card & Sales Goal Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-8 bg-card text-foreground rounded-2xl p-6 border border-border shadow-sm relative overflow-hidden flex flex-col justify-between group min-h-[220px]">
          <div className="relative z-10 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Receita Rastreada</span>
                <span className="text-[11px] font-semibold text-muted bg-secondary px-2.5 py-0.5 rounded-full border border-border">
                  Últimos {dateRange ? Math.round((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400000) : 7} dias
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight mt-1 font-sans">
                {currency(s.tracked_revenue)}
              </h2>
              {s.tracked_orders > 0 && (
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-0.5 rounded-full w-fit">
                  <span>↗</span>
                  <span>{s.tracked_orders} vendas via campanhas Meta Ads</span>
                </p>
              )}
            </div>

            {/* Animated orange line divider */}
            <RevenueWaveBackground data={spendOverTime} />

            <div className="grid grid-cols-3 gap-4 pt-4">
              <div>
                <p className="text-xs font-bold text-muted">Pedidos Rastreados</p>
                <p className="text-base sm:text-lg font-black text-foreground mt-0.5">{s.tracked_orders}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-muted">Ticket Médio</p>
                <p className="text-base sm:text-lg font-black text-foreground mt-0.5">{currency(s.arpu)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-muted">ROAS</p>
                <p className="text-base sm:text-lg font-black text-primary mt-0.5">{s.roas.toFixed(1)}x</p>
              </div>
            </div>
          </div>
        </section>

        <div className="lg:col-span-4 flex flex-col">
          <BadgeCard totalSales={s.total_sales} />
        </div>
      </div>

      {/* Modern 6 KPI Grid with Edge-to-Edge Sparklines */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Não Rastreados"
          subtitle="Vendas orgânicas/diretas"
          value={s.untracked_orders.toLocaleString('pt-BR')}
          sparklineData={getSparklinePoints('orders')}
          sparklineColor="#f97316"
        />
        <KpiCard
          label="Ticket Médio"
          subtitle="Média por pedido"
          value={currency(s.arpu)}
          sparklineData={getSparklinePoints('aov')}
          sparklineColor="#fb923c"
        />
        <KpiCard
          label="Vendas Totais"
          subtitle="Receita bruta"
          value={currency(s.total_sales)}
          sparklineData={getSparklinePoints('customers')}
          sparklineColor="#ea580c"
        />
        <KpiCard
          label="ROAS"
          subtitle="Retorno sobre investimento"
          value={`${s.roas.toFixed(2)}x`}
          sparklineData={getSparklinePoints('roas')}
          sparklineColor="#10b981"
        />
        <KpiCard
          label="Lucro Líquido"
          subtitle="Após custos e impostos"
          value={currency(s.net_profit)}
          isPositive={s.net_profit >= 0}
          sparklineData={getSparklinePoints('profit')}
          sparklineColor="#059669"
        />
        <KpiCard
          label="Reembolsos"
          subtitle="Valor devolvido"
          value={currency(s.refunded_revenue)}
          sparklineData={getSparklinePoints('refunds')}
          sparklineColor="#f43f5e"
        />
      </div>

      {/* 4-Column Grid: Funnel | Payment Status | Revenue vs Spend | Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Conversion Funnel */}
        <section>
          <FunnelChart dateRange={dateRange} selectedCampaigns={selectedCampaigns} />
        </section>

        {/* Payment Status Donut */}
        <section className="bg-card rounded-2xl p-5 border border-border shadow-sm flex flex-col">
          <h4 className="text-sm font-bold text-foreground mb-4">Receita por Status</h4>
          {(() => {
            const statusColors: Record<string, string> = {
              paid: '#10b981',
              pending: '#f59e0b',
              refunded: '#94a3b8',
              chargeback: '#f43f5e',
            }
            const statusLabels: Record<string, string> = {
              paid: 'Pago',
              pending: 'Pendente',
              refunded: 'Reembolsado',
              chargeback: 'Chargeback',
            }

            const breakdown = data?.payment_breakdown || []
            const segments = breakdown
              .filter(b => b.total > 0)
              .map(b => ({
                status: b.status,
                label: statusLabels[b.status] || b.status,
                value: b.total,
                count: b.count,
                color: statusColors[b.status] || '#cbd5e1',
              }))

            const totalCount = segments.reduce((sum, seg) => sum + seg.count, 0)
            const total = segments.reduce((sum, seg) => sum + seg.value, 0) || 1
            const circumference = 251.2

            let offset = 0
            const arcs = segments.map((seg) => {
              const pct = seg.value / total
              const dash = circumference * pct
              const gap = circumference - dash
              const arc = { ...seg, strokeDasharray: `${dash} ${gap}`, strokeDashoffset: -offset }
              offset += dash
              return arc
            })

            if (segments.length === 0) {
              return (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-muted text-center">Nenhum dado de receita disponível</p>
                </div>
              )
            }

            return (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="relative w-32 h-32 shrink-0" role="img" aria-label="Distribuição de vendas por status">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {arcs.map((arc, i) => (
                      <circle
                        key={i}
                        cx="50" cy="50" fill="none" r="40"
                        stroke={arc.color}
                        strokeWidth="14"
                        strokeDasharray={arc.strokeDasharray}
                        strokeDashoffset={arc.strokeDashoffset}
                        className="transition-all duration-300"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => setTooltip({ x: e.clientX + 12, y: e.clientY - 10, label: arc.label, value: currency(arc.value) })}
                        onMouseMove={(e) => setTooltip(prev => prev ? { ...prev, x: e.clientX + 12, y: e.clientY - 10 } : null)}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Total</span>
                    <span className="text-base font-black text-foreground">{totalCount.toLocaleString('pt-BR')}</span>
                  </div>
                  {tooltip && (
                    <div
                      className="fixed px-3 py-2 text-xs font-bold text-white bg-slate-900 rounded-xl shadow-lg pointer-events-none z-50"
                      style={{ left: tooltip.x, top: tooltip.y }}
                    >
                      {tooltip.label}: {tooltip.value}
                    </div>
                  )}
                </div>
                <div className="w-full flex flex-col space-y-1.5">
                  {segments.map((seg, i) => {
                    const pct = totalCount > 0 ? ((seg.count / totalCount) * 100).toFixed(1) : '0'
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                          <span className="text-[11px] font-bold text-muted">{seg.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] font-black text-foreground font-mono">{seg.count.toLocaleString('pt-BR')}</span>
                          <span className="text-[9px] text-muted ml-1">({pct}%)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </section>

        {/* Revenue vs Ad Spend Chart (Compact) */}
        <section className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <RevenueSpendChart data={data?.spend_over_time || []} compact />
        </section>

        {/* Recent Sales Table (Compact) */}
        <section className="bg-card rounded-2xl p-5 border border-border shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-foreground">Vendas Recentes</h4>
            <Link href="/dashboard/sales" className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 hover:bg-primary/20 transition-colors">
              Ver todas
            </Link>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <caption className="sr-only">Lista de vendas recentes</caption>
              <thead>
                <tr className="border-b border-border text-muted">
                  <th scope="col" className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider">Pedido</th>
                  <th scope="col" className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider">Cliente</th>
                  <th scope="col" className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-right">Valor</th>
                  <th scope="col" className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(data?.recent_sales) && data.recent_sales.length > 0 ? (
                  data.recent_sales.slice(0, 5).map((sale, i) => (
                    <tr key={sale.id || `${sale.customer_name}-${sale.amount}-${i}`} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                      <td className="py-2 px-2 text-[11px] font-mono text-muted">#{sale.id?.slice(0, 8) || `00${i + 1}`}</td>
                      <td className="py-2 px-2 text-[11px] font-semibold text-foreground truncate max-w-[80px]">{sale.customer_name || 'Cliente'}</td>
                      <td className="py-2 px-2 text-[11px] font-black text-foreground text-right">{currency(sale.amount)}</td>
                      <td className="py-2 px-2">
                        <StatusBadge status={sale.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[11px] text-muted">
                      Nenhuma venda recente
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* KPI Summary Footer Bar (Nexora Style) */}
      <div className="bg-card rounded-2xl p-4 sm:p-5 border border-border shadow-sm grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-center items-center">
        <div>
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Total Faturado</p>
          <p className="text-xs sm:text-sm font-black text-foreground mt-0.5">{currency(s.total_sales)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Total Pedidos</p>
          <p className="text-xs sm:text-sm font-black text-foreground mt-0.5">{s.total_paid.toLocaleString('pt-BR')}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Ticket Médio</p>
          <p className="text-xs sm:text-sm font-black text-foreground mt-0.5">{currency(s.arpu)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Margem de Lucro</p>
          <p className="text-xs sm:text-sm font-black text-foreground mt-0.5">{s.profit_margin.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Campanhas Ativas</p>
          <p className="text-xs sm:text-sm font-black text-foreground mt-0.5">{campaigns.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Canal Principal</p>
          <p className="text-xs sm:text-sm font-black text-primary mt-0.5">Meta Ads</p>
        </div>
      </div>
    </div>
  )
}

interface KpiCardProps {
  label: string
  subtitle?: string
  value: string | number
  isPositive?: boolean
  sparklineData: number[]
  sparklineColor: string
}

function KpiCard({ label, subtitle, value, isPositive, sparklineData, sparklineColor }: KpiCardProps) {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm flex flex-col justify-between relative overflow-hidden transition-all hover:border-border/80 group">
      <div className="mb-2">
        <span className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider block">{label}</span>
        {subtitle && <span className="text-[9px] text-subtle block mt-0.5">{subtitle}</span>}
        <h3 className={`text-lg sm:text-xl font-black tracking-tight truncate mt-1 ${isPositive === false ? 'text-rose-600' : 'text-foreground'}`}>{value}</h3>
      </div>

      {/* Animated sparkline */}
      <div className="w-full shrink-0 -mx-4 -mb-4 overflow-hidden rounded-b-2xl">
        <KpiSparkline data={sparklineData} color={sparklineColor} isPositive={isPositive} />
      </div>
    </div>
  )
}

const STATUS_CONFIG: Record<string, { bg: string; icon: LucideIcon; label: string }> = {
  paid: { bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-500', icon: CheckCircle, label: 'Pago' },
  pending: { bg: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-500', icon: Clock, label: 'Pendente' },
  refunded: { bg: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-500', icon: Undo, label: 'Reembolsado' },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1 ${c.bg} text-[10px] font-bold px-2 py-0.5 rounded-full`}>
      <Icon className="w-3 h-3" /> {c.label}
    </span>
  )
}