'use client'

import { useState, useEffect, useCallback } from 'react'

interface DiagnosticOrder {
  order_id: string
  amount: number
  status: string
  customer_name: string
  created_at: string
  reason: string
  reason_detail: string
  has_tracking_params: boolean
  tracking_params_sample: Record<string, string> | null
}

interface CampaignDiagnostic {
  campaign_id: string
  campaign_name: string
  tracked: number
  untracked: number
  total_revenue: number
  untracked_revenue: number
  tracking_rate: number
  top_reasons: Array<{ reason: string; count: number }>
}

interface Recommendation {
  type: 'error' | 'warning' | 'info'
  title: string
  description: string
}

interface DiagnosticsData {
  total_orders: number
  tracked_orders: number
  untracked_orders: number
  tracking_rate: number
  untracked_list: DiagnosticOrder[]
  by_campaign: CampaignDiagnostic[]
  recommendations: Recommendation[]
  period: { start_date: string; end_date: string }
}

export default function DiagnosticsPage() {
  const [data, setData] = useState<DiagnosticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      })
      if (selectedCampaign) params.set('campaign_id', selectedCampaign)

      const res = await fetch(`/api/meta-ads/diagnostics?${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error('Failed to fetch diagnostics:', err)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedCampaign])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#07050f] text-white p-6">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-white/5 rounded" />
            <div className="h-4 w-96 bg-white/5 rounded" />
            <div className="grid grid-cols-3 gap-4 mt-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-white/5 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07050f] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#f5ecd0]">Diagnóstico de Rastreamento</h1>
          <p className="text-sm text-white/50 mt-1">
            Identifique vendas não rastreadas e os motivos
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-white/40 mb-1">Data inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Data final</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Campanha</label>
            <select
              value={selectedCampaign}
              onChange={e => setSelectedCampaign(e.target.value)}
              className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white appearance-none cursor-pointer"
            >
              <option value="" className="bg-[#1a1035] text-white">Todas as campanhas</option>
              {data?.by_campaign.map(c => (
                <option key={c.campaign_id} value={c.campaign_id}>
                  {c.campaign_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white appearance-none cursor-pointer"
            >
              <option value="" className="bg-[#1a1035] text-white">Todos</option>
              <option value="paid" className="bg-[#1a1035] text-white">Pagos</option>
              <option value="pending" className="bg-[#1a1035] text-white">Pendentes</option>
            </select>
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-[#7b3fff] text-white text-sm font-medium rounded hover:bg-[#6a2fe0] transition"
          >
            Atualizar
          </button>
        </div>

        {/* KPI Cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCard
              label="Total de Pedidos"
              value={data.total_orders}
              color="text-white"
            />
            <KpiCard
              label="Pagos"
              value={data.untracked_list.filter(o => o.status === 'paid').length + data.tracked_orders}
              color="text-green-400"
            />
            <KpiCard
              label="Rastreados"
              value={data.tracked_orders}
              color="text-emerald-400"
              sub={`${data.tracking_rate}%`}
            />
            <KpiCard
              label="Não Rastreados"
              value={data.untracked_orders}
              color="text-red-400"
              sub={data.untracked_orders > 0 ? `${100 - data.tracking_rate}%` : undefined}
            />
            <KpiCard
              label="Taxa de Rastreamento"
              value={`${data.tracking_rate}%`}
              color={data.tracking_rate >= 80 ? 'text-green-400' : data.tracking_rate >= 50 ? 'text-yellow-400' : 'text-red-400'}
            />
          </div>
        )}

        {/* Recommendations */}
        {data && data.recommendations.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[#f5ecd0]">Recomendações</h2>
            {data.recommendations.map((rec, i) => (
              <div
                key={i}
                className={`p-4 rounded border ${
                  rec.type === 'error'
                    ? 'bg-red-500/10 border-red-500/30'
                    : rec.type === 'warning'
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <div className="font-medium text-sm">
                  {rec.type === 'error' ? '🔴' : rec.type === 'warning' ? '🟡' : '🔵'}{' '}
                  {rec.title}
                </div>
                <div className="text-xs text-white/60 mt-1">{rec.description}</div>
              </div>
            ))}
          </div>
        )}

        {/* Campaign Breakdown */}
        {data && data.by_campaign.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[#f5ecd0]">Por Campanha</h2>
            <div className="space-y-2">
              {data.by_campaign.map(camp => (
                <div
                  key={camp.campaign_id}
                  className="p-4 bg-white/5 border border-white/10 rounded cursor-pointer hover:bg-white/8 transition"
                  onClick={() =>
                    setSelectedCampaign(
                      selectedCampaign === camp.campaign_id ? '' : camp.campaign_id
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{camp.campaign_name}</div>
                      <div className="text-xs text-white/40 mt-1">
                        {camp.tracked} rastreados / {camp.untracked} não rastreados
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-lg font-bold ${
                          camp.tracking_rate >= 80
                            ? 'text-green-400'
                            : camp.tracking_rate >= 50
                            ? 'text-yellow-400'
                            : 'text-red-400'
                        }`}
                      >
                        {camp.tracking_rate}%
                      </div>
                      <div className="text-xs text-white/40">rastreamento</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-white/10 rounded overflow-hidden">
                    <div
                      className={`h-full rounded ${
                        camp.tracking_rate >= 80
                          ? 'bg-green-400'
                          : camp.tracking_rate >= 50
                          ? 'bg-yellow-400'
                          : 'bg-red-400'
                      }`}
                      style={{ width: `${camp.tracking_rate}%` }}
                    />
                  </div>

                  {/* Top reasons */}
                  {camp.top_reasons.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {camp.top_reasons.map((r, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 bg-white/10 rounded text-white/60"
                        >
                          {r.reason} ({r.count})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Untracked Orders List */}
        {data && (() => {
          const filtered = selectedStatus
            ? data.untracked_list.filter(o => o.status === selectedStatus)
            : data.untracked_list
          if (filtered.length === 0) return null
          return (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[#f5ecd0]">
              Pedidos Não Rastreados ({filtered.length}{selectedStatus ? ` de ${data.untracked_list.length}` : ''})
            </h2>
            <div className="space-y-1">
              {filtered.map(order => (
                <div
                  key={order.order_id}
                  className="p-3 bg-white/5 border border-white/10 rounded cursor-pointer hover:bg-white/8 transition"
                  onClick={() =>
                    setExpandedOrder(
                      expandedOrder === order.order_id ? null : order.order_id
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium">
                        R$ {order.amount.toFixed(2)}
                      </div>
                      <div className="text-xs text-white/40">{order.customer_name}</div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        order.status === 'paid'
                          ? 'bg-green-500/20 text-green-300'
                          : order.status === 'pending'
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : 'bg-white/10 text-white/40'
                      }`}>
                        {order.status === 'paid' ? 'PAGO' : order.status === 'pending' ? 'PENDENTE' : order.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs px-2 py-0.5 bg-red-500/20 text-red-300 rounded">
                        {order.reason}
                      </div>
                      <div className="text-xs text-white/30 mt-1">
                        {new Date(order.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedOrder === order.order_id && (
                    <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/60 space-y-1">
                      <div>{order.reason_detail}</div>
                      {order.tracking_params_sample && (
                        <div className="mt-2">
                          <div className="text-white/40 mb-1">tracking_params:</div>
                          <pre className="bg-white/5 p-2 rounded overflow-x-auto text-[10px]">
                            {JSON.stringify(order.tracking_params_sample, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          )
        })()}

        {/* Empty state */}
        {data && data.total_orders === 0 && (
          <div className="text-center py-12 text-white/40">
            <div className="text-lg">Nenhum pedido encontrado</div>
            <div className="text-sm mt-1">No período selecionado</div>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  color,
  sub,
}: {
  label: string
  value: string | number
  color: string
  sub?: string
}) {
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded">
      <div className="text-xs text-white/40">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-white/40 mt-0.5">{sub}</div>}
    </div>
  )
}
