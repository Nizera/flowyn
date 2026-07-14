'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type TabType = 'campaigns' | 'adsets' | 'ads'

interface Insights {
  spend: number
  impressions: number
  clicks: number
  reach: number
  conversions: number
  conversion_value: number
}

interface CampaignItem {
  campaign_id: string
  name: string
  status: string
  objective?: string
  daily_budget?: string | number
  lifetime_budget?: string | number
  insights: Insights
}

interface AdSetItem {
  ad_set_id: string
  name: string
  status: string
  daily_budget?: string | number
  lifetime_budget?: string | number
  insights: Insights
}

interface AdItem {
  ad_id: string
  name: string
  status: string
  insights: Insights
}

interface CampaignData {
  campaigns: CampaignItem[]
  ad_sets: AdSetItem[]
  ads: AdItem[]
}

function formatBRL(value: string | number | undefined) {
  const num = typeof value === 'string' ? parseFloat(value) : (value || 0)
  if (num === 0) return 'R$ 0,00'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'ACTIVE'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {isActive ? 'Ativo' : 'Pausado'}
    </span>
  )
}

function BudgetDisplay({ daily, lifetime }: { daily?: string | number; lifetime?: string | number }) {
  const d = typeof daily === 'string' ? parseFloat(daily) : (daily || 0)
  const l = typeof lifetime === 'string' ? parseFloat(lifetime) : (lifetime || 0)
  if (d > 0) {
    return <span className="text-sm">{formatBRL(d / 100)}/dia</span>
  }
  if (l > 0) {
    return <span className="text-sm">{formatBRL(l / 100)} total</span>
  }
  return <span className="text-slate-400 text-sm">Sem limite</span>
}

function MetricCell({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number
}) {
  if (value === 0) return <span className="text-slate-400">—</span>
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return <span>{prefix}{formatted}{suffix}</span>
}

export default function CampaignManagementPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const accountId = params.accountId as string

  const initialTab = (searchParams.get('tab') as TabType) || 'campaigns'
  const [tab, setTab] = useState<TabType>(initialTab)
  const [data, setData] = useState<CampaignData>({ campaigns: [], ad_sets: [], ads: [] })
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [bulkAction, setBulkAction] = useState<'PAUSED' | 'ACTIVE' | 'DELETED' | null>(null)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/meta-ads/campaigns/db?ad_account_id=${accountId}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [accountId])

  async function handleSync() {
    setIsSyncing(true)
    const res = await fetch('/api/meta-ads/sync-expanded', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad_account_id: accountId }),
    })
    const json = await res.json()
    if (json.error) alert(`Erro: ${json.error}`)
    else alert('Sincronização concluída!')
    setIsSyncing(false)
    fetchData()
  }

  async function handleToggle(item: CampaignItem | AdSetItem | AdItem, level: 'campaign' | 'adset' | 'ad') {
    const id = level === 'campaign' ? (item as CampaignItem).campaign_id : level === 'adset' ? (item as AdSetItem).ad_set_id : (item as AdItem).ad_id
    const newStatus = item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    setTogglingId(id)

    const res = await fetch('/api/meta-ads/campaigns/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ad_account_id: accountId, status: newStatus, level }),
    })
    const json = await res.json()
    if (json.error) alert(`Erro: ${json.error}`)
    else fetchData()

    setTogglingId(null)
  }

  async function handleBulk() {
    if (!bulkAction || selected.size === 0) return
    const level = tab === 'campaigns' ? 'campaign' : tab === 'adsets' ? 'adset' : 'ad'
    const ids = Array.from(selected)

    setBulkAction(null)
    const res = await fetch('/api/meta-ads/campaigns/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, ad_account_id: accountId, action: bulkAction === 'DELETED' ? 'DELETE' : bulkAction, level }),
    })
    const json = await res.json()
    if (json.error) alert(`Erro: ${json.error}`)
    else {
      setSelected(new Set())
      fetchData()
    }
  }

  function toggleSelectAll() {
    const allItems = data[tab === 'campaigns' ? 'campaigns' : tab === 'adsets' ? 'ad_sets' : 'ads']
    const filteredItems = allItems.filter((i) => {
      if (!search) return true
      return i.name?.toLowerCase().includes(search.toLowerCase())
    })
    if (selected.size === filteredItems.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredItems.map((i) =>
        tab === 'campaigns' ? (i as CampaignItem).campaign_id : tab === 'adsets' ? (i as AdSetItem).ad_set_id : (i as AdItem).ad_id
      )))
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchData()
  }, [fetchData])
  /* eslint-enable react-hooks/set-state-in-effect */

  const items: (CampaignItem | AdSetItem | AdItem)[] = data[tab === 'campaigns' ? 'campaigns' : tab === 'adsets' ? 'ad_sets' : 'ads']
  const filtered = items.filter((i) => {
    if (!search) return true
    return i.name?.toLowerCase().includes(search.toLowerCase())
  })

  const tabs = [
    { key: 'campaigns' as TabType, label: 'Campanhas', count: data.campaigns.length },
    { key: 'adsets' as TabType, label: 'Conjuntos', count: data.ad_sets.length },
    { key: 'ads' as TabType, label: 'Anúncios', count: data.ads.length },
  ]

  const getId = (item: CampaignItem | AdSetItem | AdItem) => tab === 'campaigns' ? (item as CampaignItem).campaign_id : tab === 'adsets' ? (item as AdSetItem).ad_set_id : (item as AdItem).ad_id
  const level = tab === 'campaigns' ? 'campaign' : tab === 'adsets' ? 'adset' : 'ad'

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/ads" className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Gestão de Campanhas</h1>
                <p className="text-sm text-slate-500">Conta: {accountId}</p>
              </div>
            </div>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSyncing ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sincronizando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sincronizar
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex gap-0">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setSelected(new Set()); router.push(`?tab=${t.key}`) }}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="max-w-[1600px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Bulk actions */}
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">{selected.size} selecionado(s)</span>
                  <button
                    onClick={() => { setBulkAction('ACTIVE'); handleBulk() }}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700"
                  >
                    Ativar
                  </button>
                  <button
                    onClick={() => { setBulkAction('PAUSED'); handleBulk() }}
                    className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700"
                  >
                    Pausar
                  </button>
                  <button
                    onClick={() => { if (confirm('Tem certeza que deseja excluir?')) { setBulkAction('DELETED'); handleBulk() } }}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700"
                  >
                    Excluir
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-[1600px] mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-slate-500">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Carregando dados...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm">Nenhum item encontrado</p>
            <p className="text-xs mt-1">Clique em Sincronizar para carregar dados do Meta</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10 border-b border-slate-200">
                <tr className="text-left text-slate-500 text-xs uppercase">
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 min-w-[280px]">Nome</th>
                  <th className="px-4 py-3 w-32">Status</th>
                  {tab === 'campaigns' && <th className="px-4 py-3 min-w-[160px]">Orçamento</th>}
                  {tab === 'adsets' && <th className="px-4 py-3 min-w-[160px]">Orçamento</th>}
                  <th className="px-4 py-3 text-right min-w-[120px]">Gasto</th>
                  <th className="px-4 py-3 text-right min-w-[100px]">Alcance</th>
                  <th className="px-4 py-3 text-right min-w-[110px]">Impressões</th>
                  <th className="px-4 py-3 text-right min-w-[100px]">Cliques</th>
                  <th className="px-4 py-3 text-right min-w-[80px]">CTR</th>
                  <th className="px-4 py-3 text-right min-w-[100px]">CPC</th>
                  <th className="px-4 py-3 text-right min-w-[100px]">CPM</th>
                  <th className="px-4 py-3 text-right min-w-[100px]">Conversões</th>
                  <th className="px-4 py-3 text-right min-w-[120px]">Valor Conv.</th>
                  <th className="px-4 py-3 text-right min-w-[100px]">ROAS</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const id = getId(item)
                  const ins = item.insights || { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0 }
                  const cpc = ins.clicks > 0 ? ins.spend / ins.clicks : 0
                  const cpm = ins.impressions > 0 ? (ins.spend / ins.impressions) * 1000 : 0
                  const ctr = ins.impressions > 0 ? (ins.clicks / ins.impressions) * 100 : 0
                  const roas = ins.spend > 0 ? ins.conversion_value / ins.spend : 0
                  const isToggling = togglingId === id

                      return (
                    <tr key={id} className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${selected.has(id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(id)}
                          onChange={() => toggleSelect(id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        {tab === 'campaigns' && (item as CampaignItem).objective && (
                          <div className="text-xs text-slate-400 mt-0.5">{(item as CampaignItem).objective}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggle(item, level)}
                          disabled={isToggling}
                          className="focus:outline-none"
                        >
                          {isToggling ? (
                            <svg className="animate-spin w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <StatusBadge status={item.status} />
                          )}
                        </button>
                      </td>
                      {(tab === 'campaigns' || tab === 'adsets') && (
                        <td className="px-4 py-3">
                          <BudgetDisplay
                            daily={(item as CampaignItem | AdSetItem).daily_budget}
                            lifetime={(item as CampaignItem | AdSetItem).lifetime_budget}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-medium">{formatBRL(ins.spend)}</td>
                      <td className="px-4 py-3 text-right"><MetricCell value={ins.reach} /></td>
                      <td className="px-4 py-3 text-right"><MetricCell value={ins.impressions} /></td>
                      <td className="px-4 py-3 text-right"><MetricCell value={ins.clicks} /></td>
                      <td className="px-4 py-3 text-right"><MetricCell value={ctr} suffix="%" decimals={2} /></td>
                      <td className="px-4 py-3 text-right"><MetricCell value={cpc} prefix="R$ " decimals={2} /></td>
                      <td className="px-4 py-3 text-right"><MetricCell value={cpm} prefix="R$ " decimals={2} /></td>
                      <td className="px-4 py-3 text-right"><MetricCell value={ins.conversions} /></td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">
                        <MetricCell value={ins.conversion_value} prefix="R$ " decimals={2} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${roas >= 1 ? 'text-emerald-600' : roas > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          <MetricCell value={roas} suffix="x" decimals={2} />
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-slate-400 hover:text-slate-600">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}