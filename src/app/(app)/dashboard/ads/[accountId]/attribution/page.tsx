'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type CampaignAttribution = {
  campaign_id: string
  campaign_name: string
  ad_account_id: string
  total_spend: number
  total_clicks: number
  total_impressions: number
  total_reach: number
  total_leads: number
  avg_cpc: number
  avg_cpm: number
  avg_ctr: number
  attributed_orders: number
  attributed_revenue: number
  gross_profit: number
  total_fees: number
  total_taxes: number
  total_production_costs: number
  net_profit: number
  roas: number
  roi: number
}

type AttributionResponse = {
  campaigns: CampaignAttribution[]
  period: { start_date: string; end_date: string }
  summary: {
    total_spend: number
    total_revenue: number
    total_net_profit: number
    total_orders: number
    overall_roas: number
  }
}

type UtmReportItem = {
  name: string
  revenue: number
  orders: number
}

type UtmReportResponse = {
  dimension: string
  results: UtmReportItem[]
  period: { start_date: string; end_date: string }
}

type CostConfig = {
  tax_percentage: number
  product_costs: { name: string; cost: number }[]
}

function formatBRL(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR')
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}

export default function AttributionPage() {
  const params = useParams()
  const router = useRouter()
  const accountId = params.accountId as string

  const [data, setData] = useState<AttributionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Cost config state
  const [costConfig, setCostConfig] = useState<CostConfig>({
    tax_percentage: 0,
    product_costs: [],
  })
  const [showCostModal, setShowCostModal] = useState(false)
  const [newCostName, setNewCostName] = useState('')

  // UTM report state
  const [utmData, setUtmData] = useState<UtmReportResponse | null>(null)
  const [utmDimension, setUtmDimension] = useState<string>('utm_source')
  const [utmLoading, setUtmLoading] = useState(false)
  const [newCostValue, setNewCostValue] = useState('')

  const fetchAttribution = () => {
    setLoading(true)
    setError(null)

    fetch('/api/meta-ads/attribution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ad_account_id: accountId,
        start_date: startDate,
        end_date: endDate,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setData(data)
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  const fetchCostConfig = () => {
    fetch('/api/cost-configurations')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setCostConfig(data.data)
        }
      })
      .catch(console.error)
  }

  const fetchUtmReport = (dimension: string) => {
    setUtmLoading(true)
    setUtmDimension(dimension)

    fetch('/api/meta-ads/attribution/utm-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ad_account_id: accountId,
        start_date: startDate,
        end_date: endDate,
        group_by: dimension,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) setUtmData(data)
      })
      .catch(console.error)
      .finally(() => setUtmLoading(false))
  }

  useEffect(() => {
    fetchAttribution()
    fetchCostConfig()
    fetchUtmReport('utm_source')
  }, [accountId])

  const handleSaveCostConfig = async () => {
    const res = await fetch('/api/cost-configurations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(costConfig),
    })

    if (res.ok) {
      setShowCostModal(false)
      fetchAttribution()
    }
  }

  const addProductCost = () => {
    if (!newCostName || !newCostValue) return
    setCostConfig(prev => ({
      ...prev,
      product_costs: [
        ...prev.product_costs,
        { name: newCostName, cost: parseFloat(newCostValue) || 0 }
      ]
    }))
    setNewCostName('')
    setNewCostValue('')
  }

  const removeProductCost = (index: number) => {
    setCostConfig(prev => ({
      ...prev,
      product_costs: prev.product_costs.filter((_, i) => i !== index)
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/ads/${accountId}`} className="text-muted hover:text-muted">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-foreground">Atribuição & Lucro</h1>
          <p className="mt-1 text-sm text-muted">
            Conta: {accountId} • Cruze vendas com gastos de anúncios para calcular lucro real
          </p>
        </div>
        <button
          onClick={() => setShowCostModal(true)}
          className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition hover:bg-surface"
        >
          Configurar Custos
        </button>
      </div>

      {/* Date filter */}
      <div className="flex items-end gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-bold text-muted">Data inicial</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-muted">Data final</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={fetchAttribution}
          disabled={loading}
          className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Carregando...' : 'Filtrar'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted">Gasto Total</p>
              <p className="mt-1 text-2xl font-black text-foreground">{formatBRL(data.summary.total_spend)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted">Receita</p>
              <p className="mt-1 text-2xl font-black text-emerald-600">{formatBRL(data.summary.total_revenue)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted">Lucro Líquido</p>
              <p className={`mt-1 text-2xl font-black ${data.summary.total_net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatBRL(data.summary.total_net_profit)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted">Pedidos</p>
              <p className="mt-1 text-2xl font-black text-foreground">{formatNumber(data.summary.total_orders)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted">ROAS Geral</p>
              <p className="mt-1 text-2xl font-black text-blue-600">{data.summary.overall_roas.toFixed(2)}x</p>
            </div>
          </div>

          {/* Campaign attribution table */}
          {data.campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
              <p className="text-sm text-muted">Nenhum dado de atribuição encontrado para este período.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted">Campanha</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted">Gasto</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted">Cliques</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted">CTR</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted">CPC</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted">Pedidos</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted">Receita</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted">ROAS</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted">Lucro Líquido</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.campaigns.map((campaign) => (
                    <tr key={campaign.campaign_id} className="transition hover:bg-surface">
                      <td className="px-4 py-3">
                        <p className="font-bold text-foreground">{campaign.campaign_name || campaign.campaign_id}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-foreground">{formatBRL(campaign.total_spend)}</td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">{formatNumber(campaign.total_clicks)}</td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">{formatPercent(campaign.avg_ctr)}</td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">{formatBRL(campaign.avg_cpc)}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-blue-600">{formatNumber(campaign.attributed_orders)}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-emerald-600">{formatBRL(campaign.attributed_revenue)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-bold ${campaign.roas >= 1 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {campaign.roas.toFixed(2)}x
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-bold ${campaign.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatBRL(campaign.net_profit)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-bold ${campaign.roi >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatPercent(campaign.roi)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* UTM Report Section */}
      {!loading && data && data.campaigns.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-black text-foreground">Receita por Dimensao</h3>
          <p className="mb-4 text-sm text-muted">Visualize a receita atribuida por diferentes dimensoes de rastreamento.</p>

          <div className="mb-4 flex gap-1 rounded-xl border border-border bg-surface p-1">
            {[
              { key: 'utm_source', label: 'Fonte' },
              { key: 'utm_medium', label: 'Medium' },
              { key: 'utm_content', label: 'Conteudo' },
              { key: 'campaign', label: 'Campanha' },
              { key: 'click_id', label: 'Click ID' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => fetchUtmReport(tab.key)}
                className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                  utmDimension === tab.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {utmLoading ? (
            <div className="py-8 text-center text-sm text-muted">Carregando...</div>
          ) : utmData?.results.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">Nenhum dado encontrado</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted">Dimensao</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-muted">Pedidos</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-muted">Receita</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-muted">% do Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {utmData?.results.map(item => {
                    const totalRevenue = utmData.results.reduce((s, r) => s + r.revenue, 0)
                    const pct = totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0
                    return (
                      <tr key={item.name} className="transition hover:bg-surface">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-lg bg-surface px-2.5 py-1 text-xs font-bold text-foreground">
                            {item.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-foreground">{formatNumber(item.orders)}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-emerald-600">{formatBRL(item.revenue)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-surface">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-bold text-muted">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cost Config Modal */}
      {showCostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-black text-foreground">Configurar Custos</h2>
            
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-muted">Impostos (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={costConfig.tax_percentage}
                  onChange={e => setCostConfig(prev => ({ ...prev, tax_percentage: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-muted">Custos de Produção</label>
                <div className="space-y-2">
                  {costConfig.product_costs.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-foreground">{item.name}</span>
                      <span className="text-sm font-bold text-foreground">{formatBRL(item.cost)}</span>
                      <button
                        onClick={() => removeProductCost(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Nome do custo"
                      value={newCostName}
                      onChange={e => setNewCostName(e.target.value)}
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="R$ 0,00"
                      value={newCostValue}
                      onChange={e => setNewCostValue(e.target.value)}
                      className="w-28 rounded-lg border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={addProductCost}
                      className="rounded-lg bg-surface px-3 py-2 text-sm font-bold text-foreground hover:bg-surface"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCostModal(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCostConfig}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
