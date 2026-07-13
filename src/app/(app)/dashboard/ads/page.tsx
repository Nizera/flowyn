'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'

type DashboardData = {
  summary: {
    total_spend: number
    total_revenue: number
    total_fees: number
    net_profit: number
    total_orders: number
    roas: number
    roi: number
  }
  payment_breakdown: { status: string; count: number; total: number }[]
  spend_over_time: { date: string; spend: number; revenue: number }[]
  campaigns: { campaign_id: string; campaign_name: string; spend: number; impressions: number; clicks: number; cpc: number; cpm: number }[]
  period: { start_date: string; end_date: string }
}

type AdAccount = {
  id: string
  ad_account_id: string
  ad_account_name: string | null
  pixel_id: string | null
  sync_enabled: boolean
  last_sync_at: string | null
}

const PERIOD_PRESETS = [
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
  { label: 'Este ano', days: null },
]

const PAYMENT_COLORS: Record<string, string> = {
  paid: '#10b981',
  pending: '#f59e0b',
  refunded: '#ef4444',
  cancelled: '#94a3b8',
  unknown: '#cbd5e1',
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  refunded: 'Estornado',
  cancelled: 'Cancelado',
  unknown: 'Desconhecido',
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatTimeAgo(dateStr: string | null) {
  if (!dateStr) return 'Nunca'
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Agora'
  if (diffMin < 60) return `${diffMin}min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

export default function AdsDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [periodDays, setPeriodDays] = useState<number | null>(30)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({})

  const getDateRange = () => {
    const end = new Date().toISOString().slice(0, 10)
    if (periodDays === null) {
      return { start_date: `${new Date().getFullYear()}-01-01`, end_date: end }
    }
    const start = new Date(Date.now() - periodDays * 86400000).toISOString().slice(0, 10)
    return { start_date: start, end_date: end }
  }

  useEffect(() => {
    Promise.all([fetchDashboard(), fetchAccounts()])
  }, [periodDays])

  useEffect(() => {
    const interval = setInterval(() => {
      setCooldowns(prev => {
        const updated = { ...prev }
        let changed = false
        for (const [key, value] of Object.entries(updated)) {
          if (value > 0) { updated[key] = value - 1; changed = true }
        }
        return changed ? updated : prev
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  async function fetchDashboard() {
    try {
      const { start_date, end_date } = getDateRange()
      const res = await fetch(`/api/meta-ads/dashboard?start_date=${start_date}&end_date=${end_date}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch {
      console.error('Failed to fetch dashboard')
    } finally {
      setLoading(false)
    }
  }

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/meta-ads/campaigns?action=accounts')
      const json = await res.json()
      setAccounts(json.accounts || [])
    } catch {}
  }

  async function handleSync(accountId: string) {
    if (cooldowns[accountId] > 0) return
    setSyncingId(accountId)
      try {
        const res = await fetch('/api/meta-ads/sync-expanded', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ad_account_id: accountId }),
        })
      const json = await res.json()
      if (json.error) {
        alert(`Erro: ${json.error}`)
      } else {
        setCooldowns(prev => ({ ...prev, [accountId]: 60 }))
        alert('Sincronização concluída!')
        fetchDashboard()
        fetchAccounts()
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`)
    } finally {
      setSyncingId(null)
    }
  }

  async function handleToggleSync(accountId: string, enabled: boolean) {
    try {
      await fetch('/api/meta-ads/sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_account_id: accountId, sync_enabled: enabled }),
      })
      setAccounts(prev => prev.map(a => a.ad_account_id === accountId ? { ...a, sync_enabled: enabled } : a))
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  const summary = data?.summary
  const s = summary || { total_spend: 0, total_revenue: 0, net_profit: 0, total_orders: 0, roas: 0, total_fees: 0, roi: 0 }

  const metricCards = [
    { label: 'Faturamento L\u00edquido', value: formatBRL(s.total_revenue), color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Gastos Meta Ads', value: formatBRL(s.total_spend), color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'ROAS', value: s.roas > 0 ? `${s.roas.toFixed(2)}x` : '—', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Lucro L\u00edquido', value: formatBRL(s.net_profit), color: s.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: s.net_profit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
    { label: 'Pedidos', value: String(s.total_orders), color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Taxas/Impostos', value: formatBRL(s.total_fees), color: 'text-slate-600', bg: 'bg-slate-50' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">Dashboard Meta Ads</h1>
          <p className="mt-1 text-sm text-slate-500">
            Vis\u00e3o geral das suas campanhas e m\u00e9tricas de performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {PERIOD_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => setPeriodDays(preset.days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                periodDays === preset.days
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {metricCards.map(card => (
          <div key={card.label} className={`rounded-2xl ${card.bg} p-4`}>
            <p className="text-xs font-bold text-slate-500">{card.label}</p>
            <p className={`mt-1 text-xl font-black ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Donut Chart - Payment Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-bold text-slate-900">Formas de Pagamento</h3>
          {data?.payment_breakdown && data.payment_breakdown.length > 0 ? (
            <div className="mt-4 flex items-center gap-6">
              <div className="h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.payment_breakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="total"
                      nameKey="status"
                      stroke="none"
                    >
                      {data.payment_breakdown.map((entry, i) => (
                        <Cell key={i} fill={PAYMENT_COLORS[entry.status] || PAYMENT_COLORS.unknown} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {data.payment_breakdown.map(item => (
                  <div key={item.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: PAYMENT_COLORS[item.status] || PAYMENT_COLORS.unknown }}
                      />
                      <span className="text-sm text-slate-600">{STATUS_LABELS[item.status] || item.status}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-900">{item.count}</span>
                      <span className="ml-2 text-xs text-slate-400">{formatBRL(item.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-8 text-center text-sm text-slate-400">Sem dados de pagamento</p>
          )}
        </div>

        {/* Area Chart - Spend vs Revenue */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-bold text-slate-900">Gastos x Receita</h3>
          {data?.spend_over_time && data.spend_over_time.length > 0 ? (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.spend_over_time}>
                  <defs>
                    <linearGradient id="gradSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={v => {
                      const d = new Date(v)
                      return `${d.getDate()}/${d.getMonth() + 1}`
                    }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `R$${v}`} />
                  <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#gradRevenue)" strokeWidth={2} name="Receita" />
                  <Area type="monotone" dataKey="spend" stroke="#f97316" fill="url(#gradSpend)" strokeWidth={2} name="Gastos" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-8 text-center text-sm text-slate-400">Sem dados de gastos</p>
          )}
        </div>
      </div>

      {/* Campaign Summary Table */}
      {data?.campaigns && data.campaigns.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Campanhas ({data.campaigns.length})</h3>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-bold text-slate-500">
                  <th className="pb-3 pr-4">Campanha</th>
                  <th className="pb-3 pr-4 text-right">Gasto</th>
                  <th className="pb-3 pr-4 text-right">Impress\u00f5es</th>
                  <th className="pb-3 pr-4 text-right">Cliques</th>
                  <th className="pb-3 pr-4 text-right">CPC</th>
                  <th className="pb-3 text-right">CPM</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map(c => (
                  <tr key={c.campaign_id} className="border-b border-slate-50">
                    <td className="py-3 pr-4 font-medium text-slate-900">{c.campaign_name}</td>
                    <td className="py-3 pr-4 text-right text-orange-600 font-bold">{formatBRL(c.spend)}</td>
                    <td className="py-3 pr-4 text-right text-slate-600">{c.impressions.toLocaleString('pt-BR')}</td>
                    <td className="py-3 pr-4 text-right text-slate-600">{c.clicks.toLocaleString('pt-BR')}</td>
                    <td className="py-3 pr-4 text-right text-slate-600">{formatBRL(c.cpc)}</td>
                    <td className="py-3 text-right text-slate-600">{formatBRL(c.cpm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Connected Accounts */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Contas Conectadas</h3>
          <a href="/api/meta-ads/connect" className="text-xs font-bold text-blue-600 hover:text-blue-700">
            + Conectar
          </a>
        </div>
        {accounts.length > 0 ? (
          <div className="mt-4 space-y-3">
            {accounts.map(account => {
              const cooldown = cooldowns[account.ad_account_id] || 0
              const isSyncing = syncingId === account.ad_account_id
              return (
                <div key={account.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-4">
                  <div>
                    <p className="font-bold text-slate-900">{account.ad_account_name || account.ad_account_id}</p>
                    <p className="text-xs text-slate-400">
                      \u00daltimo sync: {formatTimeAgo(account.last_sync_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleSync(account.ad_account_id, !account.sync_enabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                        account.sync_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${
                        account.sync_enabled ? 'translate-x-4.5' : 'translate-x-1'
                      }`} />
                    </button>
                    <button
                      onClick={() => handleSync(account.ad_account_id)}
                      disabled={isSyncing || cooldown > 0}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      {isSyncing ? '...' : cooldown > 0 ? `${cooldown}s` : 'Sync'}
                    </button>
                    <Link
                      href={`/dashboard/ads/${account.ad_account_id}`}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
                    >
                      Detalhes
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-400">Nenhuma conta conectada</p>
            <a href="/api/meta-ads/connect" className="mt-2 inline-block text-sm font-bold text-blue-600 hover:text-blue-700">
              Conectar conta Meta Ads
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
