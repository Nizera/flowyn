'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { SalesGoalCard } from '@/components/SalesGoalCard'
import { DashboardFilters } from './DashboardFilters'
import { TrendingUp, CreditCard, CheckCircle, Undo, Clock, AlertCircle, RefreshCw, Unlink } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { currency } from '@/lib/format'

const FunnelChart = dynamic(
  () => import('./FunnelChart').then(m => ({ default: m.FunnelChart })),
  { loading: () => <div className="h-[200px] animate-pulse rounded-xl bg-surface" /> },
)
const RevenueSpendChart = dynamic(
  () => import('./RevenueSpendChart').then(m => ({ default: m.RevenueSpendChart })),
  { loading: () => <div className="h-[300px] animate-pulse rounded-xl bg-surface" /> },
)
const RevenueShaderBackground = dynamic(
  () => import('./RevenueShaderBackground').then(m => ({ default: m.RevenueShaderBackground })),
  { ssr: false, loading: () => null },
)

interface Summary {
  total_revenue: number
  total_spend: number
  total_sales: number
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
  untracked_revenue: number
  untracked_orders: number
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
  total_revenue: 0, total_spend: 0, total_sales: 0, roas: 0, net_profit: 0,
  total_orders: 0, pending_revenue: 0, refunded_revenue: 0,
  profit_margin: 0, arpu: 0, chargeback_rate: 0, chargeback_count: 0,
  chargeback_revenue: 0, total_impressions: 0, total_clicks: 0,
  aggregate_ctr: 0, aggregate_cpc: 0, aggregate_cpm: 0,
  total_taxes: 0, total_production_costs: 0, roi: 0,
  untracked_revenue: 0, untracked_orders: 0,
}

function getDefaultDateRange() {
  const now = new Date()
  const from = new Date(now.getTime() - 30 * 86400000)
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

  // Fetch user's campaigns for the filter selector
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Visão Geral</h1>
          <p className="text-xs text-muted mt-0.5">Acompanhe sua operação de vendas e desempenho de anúncios.</p>
        </div>
        <button
          onClick={handleSyncAllActive}
          disabled={syncingAll}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-sm transition hover:bg-surface disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
          {syncingAll ? 'Sincronizando contas...' : 'Sincronizar Contas Ativas'}
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

      {/* Revenue Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-8 bg-card rounded-2xl p-6 border border-border shadow-sm relative overflow-hidden flex flex-col justify-between group">
          {/* Particle Constellation Background (Antigravity interactive style) */}
          <RevenueShaderBackground />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">Faturamento</span>
              {s.total_revenue > 0 && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  +{s.total_orders} vendas
                </span>
              )}
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
              {currency(s.total_revenue)}
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border relative z-10">
            <div>
              <p className="text-xs font-bold text-muted">Vendas</p>
              <p className="text-lg font-black text-foreground">{s.total_orders}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted">Ticket Médio</p>
              <p className="text-lg font-black text-foreground">{currency(s.arpu)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted">ROI</p>
              <p className="text-lg font-black text-emerald-600">{s.roi.toFixed(1)}%</p>
            </div>
          </div>
        </section>

        <div className="lg:col-span-4 flex flex-col">
          <SalesGoalCard totalSales={s.total_sales} />
        </div>
      </div>

      {/* Performance Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <MetricPill label="Faturamento Líquido" value={currency(s.total_revenue - s.refunded_revenue)} />
        <MetricPill label="Gasto com Anúncios" value={currency(s.total_spend)} />
        <MetricPill label="ROAS" value={`${s.roas.toFixed(1)}x`} />
        <MetricPill label="Lucro Líquido" value={currency(s.net_profit)} positive={s.net_profit >= 0} />
        <MetricPill label="Margem de Lucro" value={`${s.profit_margin.toFixed(0)}%`} positive={s.profit_margin >= 0} />
        <MetricPill label="Chargeback" value={s.chargeback_count > 0 ? `${s.chargeback_count} (${currency(s.chargeback_revenue)})` : '0'} />
        {s.untracked_orders > 0 && !selectedCampaigns && (
          <MetricPill
            label="Vendas s/ Rastreamento"
            value={`${s.untracked_orders} (${currency(s.untracked_revenue)})`}
            icon={Unlink}
            iconColor="text-amber-500"
          />
        )}
      </div>

      {/* Secondary Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricPill label="Impressões" value={s.total_impressions.toLocaleString('pt-BR')} />
        <MetricPill label="Cliques" value={s.total_clicks.toLocaleString('pt-BR')} />
        <MetricPill label="CTR" value={`${s.aggregate_ctr.toFixed(2)}%`} />
        <MetricPill label="CPC" value={currency(s.aggregate_cpc)} />
        <MetricPill label="CPM" value={currency(s.aggregate_cpm)} />
      </div>

      {/* Main Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3">
          <FunnelChart dateRange={dateRange} selectedCampaigns={selectedCampaigns} />
        </section>

        <section className="lg:col-span-2 bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col items-center">
          <h3 className="text-lg font-bold text-foreground mb-6 self-start w-full">Receita por Status</h3>
          {(() => {
            const statusColors: Record<string, string> = {
              paid: '#10b981',
              pending: '#fcd34d',
              refunded: '#94a3b8',
              chargeback: '#f87171',
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

            return (
              <>
                <div className="relative w-48 h-48 mb-6" role="img" aria-label="Distribuição de vendas por status">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {arcs.map((arc, i) => (
                      <circle
                        key={i}
                        cx="50" cy="50" fill="none" r="40"
                        stroke={arc.color}
                        strokeWidth="16"
                        strokeDasharray={arc.strokeDasharray}
                        strokeDashoffset={arc.strokeDashoffset}
                        className="transition-all duration-200"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => setTooltip({ x: e.clientX + 12, y: e.clientY - 10, label: arc.label, value: currency(arc.value) })}
                        onMouseMove={(e) => setTooltip(prev => prev ? { ...prev, x: e.clientX + 12, y: e.clientY - 10 } : null)}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <CreditCard className="w-8 h-8 text-muted" />
                  </div>
                  {tooltip && (
                    <div
                      className="fixed px-3 py-2 text-sm font-bold text-white bg-slate-900 rounded-xl shadow-lg pointer-events-none z-50"
                      style={{ left: tooltip.x, top: tooltip.y }}
                    >
                      {tooltip.label}: {tooltip.value}
                    </div>
                  )}
                </div>
                <div className="w-full grid grid-cols-2 gap-y-3 mt-auto">
                  {segments.map((seg, i) => (
                    <div key={i} className="flex items-center gap-2 group relative">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
                      <span className="text-sm text-muted">{seg.label}</span>
                      <div className="absolute bottom-full left-0 mb-1 px-2 py-1 text-xs font-bold text-white bg-slate-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        {seg.label}: {currency(seg.value)}
                      </div>
                    </div>
                  ))}
                </div>
                {segments.length === 0 && (
                  <p className="text-sm text-muted mt-4">Nenhum dado de receita disponível.</p>
                )}
              </>
            )
          })()}
        </section>
      </div>

      {/* Revenue vs Spend Chart */}
      <section className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <RevenueSpendChart data={data?.spend_over_time || []} />
      </section>

      {/* Recent Activity */}
      <section className="bg-card rounded-2xl p-6 border border-border shadow-sm mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">Vendas Recentes</h3>
          <Link href="/dashboard/sales" className="text-sm font-medium text-orange-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 rounded">
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <caption className="sr-only">Lista de vendas recentes</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-3 px-4 text-xs font-bold text-muted">Cliente</th>
                <th scope="col" className="py-3 px-4 text-xs font-bold text-muted">Produto</th>
                <th scope="col" className="py-3 px-4 text-xs font-bold text-muted">Valor</th>
                <th scope="col" className="py-3 px-4 text-xs font-bold text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(data?.recent_sales) && data.recent_sales.length > 0 ? (
                data.recent_sales.slice(0, 5).map((sale, i) => (
                  <tr key={sale.id || `${sale.customer_name}-${sale.amount}-${i}`} className="border-b border-border hover:bg-surface/50 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-foreground">{sale.customer_name || 'Cliente'}</td>
                    <td className="py-3 px-4 text-sm text-muted">{sale.product_name || 'Produto'}</td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">{currency(sale.amount)}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={sale.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-muted">
                    Nenhuma venda recente
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function MetricPill({ label, value, positive = true, icon: Icon, iconColor }: { label: string; value: string; positive?: boolean; icon?: LucideIcon; iconColor?: string }) {
  return (
    <div className="bg-card rounded-2xl p-3 border border-border shadow-sm flex flex-col gap-1 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted truncate flex items-center gap-1">
          {Icon && <Icon className={`w-3 h-3 ${iconColor || ''}`} />}
          {label}
        </span>
        <span className={`text-[10px] font-bold flex items-center ${positive ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'} px-1.5 py-0.5 rounded`}>
          {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
        </span>
      </div>
      <span className="text-base font-bold text-foreground">{value}</span>
    </div>
  )
}

const STATUS_CONFIG: Record<string, { bg: string; icon: LucideIcon; label: string }> = {
  paid: { bg: 'bg-emerald-100 text-emerald-800', icon: CheckCircle, label: 'Pago' },
  pending: { bg: 'bg-amber-100 text-amber-800', icon: Clock, label: 'Pendente' },
  refunded: { bg: 'bg-rose-100 text-rose-800', icon: Undo, label: 'Reembolsado' },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1 ${c.bg} text-[10px] font-bold px-2 py-1 rounded-full`}>
      <Icon className="w-3.5 h-3.5" /> {c.label}
    </span>
  )
}