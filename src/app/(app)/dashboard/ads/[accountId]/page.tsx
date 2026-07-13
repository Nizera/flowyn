'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type Campaign = {
  campaign_id: string
  name: string
  status: string
  effective_status: string
  objective: string
  buying_type: string | null
  daily_budget: number | null
  lifetime_budget: number | null
  bid_strategy: string | null
  special_ad_categories: string[]
  created_time: string
  updated_time: string
  synced_at: string
}

type AdSet = {
  ad_set_id: string
  campaign_id: string
  name: string
  status: string
  effective_status: string
  optimization_goal: string
  billing_event: string
  bid_strategy: string | null
  bid_amount: string | null
  budget_remaining: number | null
  daily_budget: number | null
  lifetime_budget: number | null
  start_time: string | null
  end_time: string | null
  targeting: any
  synced_at: string
}

type Ad = {
  ad_id: string
  ad_set_id: string
  campaign_id: string
  name: string
  status: string
  effective_status: string
  creative_id: string | null
  title: string | null
  body: string | null
  description: string | null
  cta_type: string | null
  cta_text: string | null
  image_url: string | null
  thumbnail_url: string | null
  video_id: string | null
  website_url: string | null
  trackings: any
  synced_at: string
}

type TabType = 'campaigns' | 'adsets' | 'ads'

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativa',
  PAUSED: 'Pausada',
  DELETED: 'Excluída',
  PENDING_REVIEW: 'Em análise',
  PREAPPROVED: 'Pré-aprovada',
  DISAPPROVED: 'Rejeitada',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  PAUSED: 'bg-amber-50 text-amber-700',
  DELETED: 'bg-red-50 text-red-700',
  PENDING_REVIEW: 'bg-blue-50 text-blue-700',
  PREAPPROVED: 'bg-violet-50 text-violet-700',
  DISAPPROVED: 'bg-red-50 text-red-700',
}

function formatBRL(cents: number | null) {
  if (!cents) return '—'
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

function formatNumber(num: number | null) {
  if (num === null || num === undefined) return '—'
  return num.toLocaleString('pt-BR')
}

function formatTimeAgo(dateStr: string | null) {
  if (!dateStr) return '—'
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

function getEffectiveStatus(status: string, effectiveStatus: string) {
  return effectiveStatus || status
}

export default function CampaignManagementPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const accountId = params.accountId as string

  const [tab, setTab] = useState<TabType>('campaigns')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [adSets, setAdSets] = useState<AdSet[]>([])
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/meta-ads/campaigns/db?ad_account_id=${accountId}`)
      if (!res.ok) throw new Error('Falha ao buscar dados')
      const data = await res.json()
      if (data.campaigns) setCampaigns(data.campaigns)
      if (data.ad_sets) setAdSets(data.ad_sets)
      if (data.ads) setAds(data.ads)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle search params for tab
  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabType | null
    if (tabParam && ['campaigns', 'adsets', 'ads'].includes(tabParam)) {
      setTab(tabParam)
    }
  }, [searchParams])

  const handleSelectAll = (items: any[], idKey: string) => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map(item => item[idKey])))
    }
  }

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkAction = async (action: 'pause' | 'resume' | 'delete') => {
    if (selectedIds.size === 0) return

    const ids = Array.from(selectedIds)
    try {
      const res = await fetch('/api/meta-ads/campaigns/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, ad_account_id: accountId, level: tab }),
      })
      if (!res.ok) throw new Error('Falha na ação em lote')
      setSelectedIds(new Set())
      fetchData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleToggle = async (item: Campaign | AdSet | Ad, level: 'campaign' | 'adset' | 'ad') => {
    const currentStatus = getEffectiveStatus(item.status, item.effective_status)
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'

    try {
      const res = await fetch('/api/meta-ads/campaigns/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tab === 'campaigns' ? (item as Campaign).campaign_id :
              tab === 'adsets' ? (item as AdSet).ad_set_id :
              (item as Ad).ad_id,
          ad_account_id: accountId,
          status: newStatus,
          level,
        }),
      })
      if (!res.ok) throw new Error('Falha ao alterar status')
      fetchData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const filteredCampaigns = campaigns.filter(c => {
    const status = getEffectiveStatus(c.status, c.effective_status)
    if (filters.status !== 'all' && status !== filters.status) return false
    if (filters.search && !c.name.toLowerCase().includes(filters.search.toLowerCase())) return false
    return true
  })

  const filteredAdSets = adSets.filter(a => {
    const status = getEffectiveStatus(a.status, a.effective_status)
    if (filters.status !== 'all' && status !== filters.status) return false
    if (filters.search && !a.name.toLowerCase().includes(filters.search.toLowerCase())) return false
    return true
  })

  const filteredAds = ads.filter(a => {
    const status = getEffectiveStatus(a.status, a.effective_status)
    if (filters.status !== 'all' && status !== filters.status) return false
    if (filters.search && !a.name.toLowerCase().includes(filters.search.toLowerCase())) return false
    return true
  })

  const Tabs = [
    { key: 'campaigns', label: 'Campanhas', count: campaigns.length },
    { key: 'adsets', label: 'Conjuntos', count: adSets.length },
    { key: 'ads', label: 'Anúncios', count: ads.length },
  ] as const

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">{error}</p>
        <Link href="/dashboard/ads" className="mt-4 inline-block text-sm font-bold text-blue-600 hover:underline">
          Voltar
        </Link>
      </div>
    )
  }

  const currentItems = tab === 'campaigns' ? filteredCampaigns : tab === 'adsets' ? filteredAdSets : filteredAds
  const currentIdKey = tab === 'campaigns' ? 'campaign_id' : tab === 'adsets' ? 'ad_set_id' : 'ad_id'
  const selectedCount = selectedIds.size

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ads" className="text-slate-400 hover:text-slate-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-slate-950">Gestão de Campanhas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Conta: {accountId} • {campaigns.length} campanhas, {adSets.length} conjuntos, {ads.length} anúncios
          </p>
        </div>
        <Link
          href={`/dashboard/ads/${accountId}/attribution`}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
        >
          Ver Atribuição & Lucro
        </Link>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white p-1">
        <div className="flex gap-1">
          {Tabs.map(t => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key)
                router.push(`/dashboard/ads/${accountId}?tab=${t.key}`)
              }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
                tab === t.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t.label}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                tab === t.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-center justify-between">
          <span className="text-sm font-bold text-blue-800">
            {selectedCount} item{selectedCount > 1 ? 's' : ''} selecionado{selectedCount > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('pause')}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-700"
            >
              Pausar
            </button>
            <button
              onClick={() => handleBulkAction('resume')}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              Retomar
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm font-bold text-slate-500 hover:text-slate-700"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Buscar</span>
            <input
              type="text"
              placeholder="Nome da campanha/conjunto/anúncio..."
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Status</span>
          <select
            value={filters.status}
            onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Todos</option>
            <option value="ACTIVE">Ativas</option>
            <option value="PAUSED">Pausadas</option>
            <option value="DELETED">Excluídas</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
          <table className="w-full">
            <thead>
              <tr>
                <th className="w-12 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === currentItems.length && currentItems.length > 0}
                    onChange={() => handleSelectAll(currentItems, currentIdKey)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                {tab === 'campaigns' && (
                  <>
                    <th className="px-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Campanha</th>
                    <th className="px-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Objetivo</th>
                    <th className="px-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Orçamento</th>
                    <th className="px-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Bid Strategy</th>
                  </>
                )}
                {tab === 'adsets' && (
                  <>
                    <th className="px-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Conjunto</th>
                    <th className="px-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Campanha</th>
                    <th className="px-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Objetivo</th>
                    <th className="px-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Orçamento</th>
                  </>
                )}
                {tab === 'ads' && (
                  <>
                    <th className="px-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Anúncio</th>
                    <th className="px-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Conjunto</th>
                    <th className="px-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Criativo</th>
                    <th className="px-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">CTA</th>
                  </>
                )}
                <th className="w-36 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="w-40 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Sync</th>
                <th className="w-32 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Ações</th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Body */}
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <tbody className="divide-y divide-slate-100">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm text-slate-400">
                    Nenhum {tab === 'campaigns' ? 'campanha' : tab === 'adsets' ? 'conjunto' : 'anúncio'} encontrado
                  </td>
                </tr>
              ) : (
                currentItems.map((item) => {
                  const itemId = (item as any)[currentIdKey]
                  const isSelected = selectedIds.has(itemId)
                  const status = getEffectiveStatus(item.status, item.effective_status)

                  if (tab === 'campaigns') {
                    const c = item as Campaign
                    return (
                      <tr key={c.campaign_id} className={`transition ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectOne(c.campaign_id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-400">{c.campaign_id}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 capitalize">{c.objective.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-4">
                          {c.daily_budget ? (
                            <span className="font-bold text-slate-900">{formatBRL(c.daily_budget)}/dia</span>
                          ) : c.lifetime_budget ? (
                            <span className="font-bold text-slate-900">{formatBRL(c.lifetime_budget)} total</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500">{c.bid_strategy || '—'}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[status] || STATUS_COLORS.ACTIVE}`}>
                            {STATUS_LABELS[status] || status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-xs text-slate-400">
                          {formatTimeAgo(c.synced_at)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggle(c, 'campaign')}
                              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                                status === 'ACTIVE'
                                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              }`}
                            >
                              {status === 'ACTIVE' ? 'Pausar' : 'Retomar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  if (tab === 'adsets') {
                    const a = item as AdSet
                    return (
                      <tr key={a.ad_set_id} className={`transition ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectOne(a.ad_set_id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-slate-900">{a.name}</p>
                          <p className="text-xs text-slate-400">{a.ad_set_id}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500">{a.campaign_id}</td>
                        <td className="px-4 py-4 text-sm text-slate-600 capitalize">{a.optimization_goal.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-4">
                          {a.daily_budget ? (
                            <span className="font-bold text-slate-900">{formatBRL(a.daily_budget)}/dia</span>
                          ) : a.lifetime_budget ? (
                            <span className="font-bold text-slate-900">{formatBRL(a.lifetime_budget)} total</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[status] || STATUS_COLORS.ACTIVE}`}>
                            {STATUS_LABELS[status] || status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-xs text-slate-400">
                          {formatTimeAgo(a.synced_at)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggle(a, 'adset')}
                              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                                status === 'ACTIVE'
                                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              }`}
                            >
                              {status === 'ACTIVE' ? 'Pausar' : 'Retomar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  // tab === 'ads'
                  const ad = item as Ad
                  return (
                    <tr key={ad.ad_id} className={`transition ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(ad.ad_id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {ad.thumbnail_url && (
                            <img
                              src={ad.thumbnail_url}
                              alt=""
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                          )}
                          <div>
                            <p className="font-bold text-slate-900">{ad.name}</p>
                            <p className="text-xs text-slate-400">{ad.ad_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">{ad.ad_set_id}</td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          {ad.title && <p className="text-xs font-medium text-slate-700">{ad.title}</p>}
                          {ad.body && <p className="text-xs text-slate-500 line-clamp-1">{ad.body}</p>}
                          {ad.image_url && (
                            <img
                              src={ad.image_url}
                              alt=""
                              className="h-16 w-auto rounded-lg object-cover"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">{ad.cta_type || '—'}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[status] || STATUS_COLORS.ACTIVE}`}>
                          {STATUS_LABELS[status] || status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-xs text-slate-400">
                        {formatTimeAgo(ad.synced_at)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggle(ad, 'ad')}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                              status === 'ACTIVE'
                                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            }`}
                          >
                            {status === 'ACTIVE' ? 'Pausar' : 'Retomar'}
                          </button>
                        </div>
                      </td>
                      </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}