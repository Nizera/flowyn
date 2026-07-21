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
  landing_page_views: number
  initiate_checkout: number
  cpc: number | null
  cpm: number | null
  ctr: number | null
  cpv: number | null
  cpi: number | null
  cpa: number | null
  roas: number | null
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
  if (d > 0) return <span className="text-sm">{formatBRL(d / 100)}/dia</span>
  if (l > 0) return <span className="text-sm">{formatBRL(l / 100)} total</span>
  return <span className="text-slate-400 text-sm">Sem limite</span>
}

function MetricCell({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number
}) {
  if (value === 0) return <span className="text-slate-400">&mdash;</span>
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return <span>{prefix}{formatted}{suffix}</span>
}

function getDefaultDateRange() {
  const now = new Date()
  const from = new Date(now.getTime() - 30 * 86400000)
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
}

const DATE_PRESETS = [
  { label: 'Ultimos 7 dias', days: 7 },
  { label: 'Ultimos 14 dias', days: 14 },
  { label: 'Ultimos 30 dias', days: 30 },
  { label: 'Ultimos 90 dias', days: 90 },
  { label: 'Este mes', days: 'month' as const },
  { label: 'Mes passado', days: 'lastmonth' as const },
]

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
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState<Set<string>>(new Set())
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [bulkAction, setBulkAction] = useState<'PAUSED' | 'ACTIVE' | 'DELETED' | null>(null)
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState(getDefaultDateRange)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [showGroupMenu, setShowGroupMenu] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateTarget, setDuplicateTarget] = useState('')
  const [duplicateNameSuffix, setDuplicateNameSuffix] = useState('')
  const [duplicateStartPaused, setDuplicateStartPaused] = useState(true)
  const [duplicateQuantity, setDuplicateQuantity] = useState(1)
  const [duplicating, setDuplicating] = useState(false)
  const [duplicateLimit, setDuplicateLimit] = useState<{ max_copies: number; api_cost_per_copy: number; ad_sets: number; total_ads: number } | null>(null)
  const [accounts, setAccounts] = useState<{ ad_account_id: string; ad_account_name: string | null }[]>([])

  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [budgetEditItem, setBudgetEditItem] = useState<CampaignItem | AdSetItem | null>(null)
  const [budgetType, setBudgetType] = useState<'daily' | 'lifetime'>('daily')
  const [budgetValue, setBudgetValue] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)

  const [bulkBudgetModalOpen, setBulkBudgetModalOpen] = useState(false)
  const [bulkBudgetAction, setBulkBudgetAction] = useState<'increase' | 'decrease' | 'set'>('increase')
  const [bulkBudgetAmount, setBulkBudgetAmount] = useState('')
  const [bulkBudgetType, setBulkBudgetType] = useState<'daily' | 'lifetime'>('daily')
  const [savingBulkBudget, setSavingBulkBudget] = useState(false)

  const [visibleColumns, setVisibleColumns] = useState({
    reach: true,
    impressions: true,
    clicks: true,
    ctr: true,
    cpc: true,
    cpm: true,
    landingPageViews: true,
    cpv: true,
    initiateCheckout: true,
    cpi: true,
    conversions: true,
    cpa: true,
    conversionValue: true,
    roas: true,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/meta-ads/campaigns/db?ad_account_id=${accountId}&date_from=${dateRange.from}&date_to=${dateRange.to}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [accountId, dateRange])

  async function handleSync() {
    setIsSyncing(true)
    const res = await fetch('/api/meta-ads/sync-expanded', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad_account_id: accountId }),
    })
    const json = await res.json()
    if (json.error) alert(`Erro: ${json.error}`)
    else alert('Sincronizacao concluida!')
    setIsSyncing(false)
    fetchData()
  }

  async function fetchAccounts() {
    const res = await fetch('/api/meta-ads/campaigns?action=accounts')
    const json = await res.json()
    setAccounts(json.accounts || [])
  }

  function openDuplicateModal() {
    setDuplicateTarget('')
    setDuplicateNameSuffix('')
    setDuplicateStartPaused(true)
    setDuplicateQuantity(1)
    setDuplicateLimit(null)
    setShowDuplicateModal(true)
    fetchAccounts()
    const firstCampaign = [...selected][0]
    if (firstCampaign) {
      fetch(`/api/meta-ads/campaigns/duplicate?campaign_id=${firstCampaign}&account_id=${accountId}`)
        .then(r => r.json())
        .then(json => {
          if (!json.error) {
            setDuplicateLimit(json)
            setDuplicateQuantity(Math.min(1, json.max_copies))
          }
        })
        .catch(() => {})
    }
  }

  async function handleDuplicate() {
    if (selected.size === 0) return
    setDuplicating(true)
    const results: string[] = []
    for (const campaignId of selected) {
      const res = await fetch('/api/meta-ads/campaigns/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_campaign_id: campaignId,
          source_ad_account_id: accountId,
          target_ad_account_id: duplicateTarget || accountId,
          name_suffix: duplicateNameSuffix,
          copy_ad_sets: true,
          copy_ads: true,
          start_paused: duplicateStartPaused,
          quantity: duplicateQuantity,
        }),
      })
      const json = await res.json()
      if (json.error) results.push(`Erro: ${json.error}`)
      else results.push(`${json.copies} copia(s) criada(s) com sucesso!`)
    }
    setShowDuplicateModal(false)
    setSelected(new Set())
    alert(results.join('\n'))
    setDuplicating(false)
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

  async function handleBulk(action?: 'PAUSED' | 'ACTIVE' | 'DELETED') {
    const effectiveAction = action || bulkAction
    if (!effectiveAction || selected.size === 0) return
    const level = tab === 'campaigns' ? 'campaign' : tab === 'adsets' ? 'adset' : 'ad'
    const ids = Array.from(selected)
    setBulkAction(null)
    const res = await fetch('/api/meta-ads/campaigns/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, ad_account_id: accountId, action: effectiveAction === 'DELETED' ? 'delete' : effectiveAction === 'PAUSED' ? 'pause' : 'resume', level }),
    })
    const json = await res.json()
    if (json.error) alert(`Erro: ${json.error}`)
    else {
      if (json.errors && json.errors.length > 0) {
        alert(`Alguns itens falharam:\n${json.errors.join('\n')}`)
      }
      setSelected(new Set())
      fetchData()
    }
  }

  function toggleSelectAll() {
    const allItems = tab === 'campaigns' ? data.campaigns : tab === 'adsets' ? rawAdSets : rawAds
    const filteredItems = allItems.filter(i => !search || i.name?.toLowerCase().includes(search.toLowerCase()))
    if (selected.size === filteredItems.length) setSelected(new Set())
    else setSelected(new Set(filteredItems.map(i => tab === 'campaigns' ? (i as CampaignItem).campaign_id : tab === 'adsets' ? (i as AdSetItem).ad_set_id : (i as AdItem).ad_id)))
  }

  function toggleSelect(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  function openBudgetEdit(item: CampaignItem | AdSetItem) {
    setBudgetEditItem(item)
    const hasDaily = !!item.daily_budget && Number(item.daily_budget) > 0
    setBudgetType(hasDaily ? 'daily' : 'lifetime')
    const current = hasDaily ? Number(item.daily_budget) : Number(item.lifetime_budget || 0)
    setBudgetValue(current > 0 ? String(current / 100) : '')
    setBudgetModalOpen(true)
  }

  async function handleSaveBudget() {
    if (!budgetEditItem) return
    setSavingBudget(true)
    const id = 'campaign_id' in budgetEditItem ? budgetEditItem.campaign_id : budgetEditItem.ad_set_id
    const level = tab === 'campaigns' ? 'campaign' : 'adset'
    const payload: Record<string, unknown> = {
      id, ad_account_id: accountId, level,
    }
    if (budgetType === 'daily') payload.daily_budget = Math.round(Number(budgetValue) * 100)
    else payload.lifetime_budget = Math.round(Number(budgetValue) * 100)

    const res = await fetch('/api/meta-ads/campaigns/budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setSavingBudget(false)
    if (json.error) alert(`Erro: ${json.error}`)
    else {
      if (json.applied_to === 'campaign') {
        alert('Orcamento aplicado no nivel da Campanha (CBO ativo neste conjunto).')
      }
      setBudgetModalOpen(false)
      fetchData()
    }
  }

  async function handleBulkBudget() {
    if (selected.size === 0 || !bulkBudgetAmount) return
    setSavingBulkBudget(true)
    const level = tab === 'campaigns' ? 'campaign' : 'adset'
    const actionMap = { increase: 'increase_budget', decrease: 'decrease_budget', set: 'set_budget' }

    const res = await fetch('/api/meta-ads/campaigns/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: Array.from(selected),
        ad_account_id: accountId,
        action: actionMap[bulkBudgetAction],
        level,
        budget_amount: Number(bulkBudgetAmount),
        budget_type: bulkBudgetType,
      }),
    })
    const json = await res.json()
    setSavingBulkBudget(false)
    if (json.error) alert(`Erro: ${json.error}`)
    else {
      if (json.errors && json.errors.length > 0) alert(`Alguns itens falharam:\n${json.errors.join('\n')}`)
      const campaignRedirects = (json.results || []).filter((r: { applied_to?: string }) => r.applied_to === 'campaign')
      if (campaignRedirects.length > 0) {
        alert(`${campaignRedirects.length} item(ns) tiveram orcamento aplicado na Campanha (CBO ativo).`)
      }
      setBulkBudgetModalOpen(false)
      setSelected(new Set())
      fetchData()
    }
  }

  function applyDatePreset(preset: typeof DATE_PRESETS[number]) {
    const now = new Date()
    let from: Date
    if (preset.days === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (preset.days === 'lastmonth') {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const to = new Date(now.getFullYear(), now.getMonth(), 0)
      setDateRange({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) })
      setShowDatePicker(false)
      return
    } else {
      from = new Date(now.getTime() - (preset.days as number) * 86400000)
    }
    setDateRange({ from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) })
    setShowDatePicker(false)
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { fetchData() }, [fetchData])
  /* eslint-enable react-hooks/set-state-in-effect */

  const filterIds = tab !== 'campaigns' && selectedCampaignFilter.size > 0
    ? [...selectedCampaignFilter]
    : null

  const allCampaignIds = data.campaigns.map(c => c.campaign_id)
  const showAll = !filterIds || filterIds.length === allCampaignIds.length

  const rawAdSets = showAll ? data.ad_sets : data.ad_sets.filter((a: AdSetItem & { campaign_id?: string }) =>
    filterIds!.includes(a.campaign_id || '')
  )
  const rawAds = showAll ? data.ads : data.ads.filter((a: AdItem & { campaign_id?: string }) =>
    filterIds!.includes(a.campaign_id || '')
  )

  const items: (CampaignItem | AdSetItem | AdItem)[] = tab === 'campaigns' ? data.campaigns : tab === 'adsets' ? rawAdSets : rawAds
  const filtered = items.filter(i => !search || i.name?.toLowerCase().includes(search.toLowerCase()))

  const tabs = [
    { key: 'campaigns' as TabType, label: 'Campanhas', count: data.campaigns.length },
    { key: 'adsets' as TabType, label: 'Conjuntos', count: data.ad_sets.length },
    { key: 'ads' as TabType, label: 'Anuncios', count: data.ads.length },
  ]
  const getId = (item: CampaignItem | AdSetItem | AdItem) => tab === 'campaigns' ? (item as CampaignItem).campaign_id : tab === 'adsets' ? (item as AdSetItem).ad_set_id : (item as AdItem).ad_id
  const level = tab === 'campaigns' ? 'campaign' : tab === 'adsets' ? 'adset' : 'ad'

  const formatDateRange = () => {
    const from = new Date(dateRange.from + 'T00:00:00')
    const to = new Date(dateRange.to + 'T00:00:00')
    return `${from.toLocaleDateString('pt-BR')} - ${to.toLocaleDateString('pt-BR')}`
  }

  const toggleColumn = (key: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="min-h-screen bg-white">
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
                <h1 className="text-lg font-bold text-slate-900">Gestao de Campanhas</h1>
                <p className="text-sm text-slate-500">Conta: {accountId}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/dashboard/ads/${accountId}/rules`}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Regras
              </Link>
              <button onClick={handleSync} disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
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
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex gap-0">
            {tabs.map(t => (
              <button key={t.key}
                onClick={() => {
                  if (tab === 'campaigns' && t.key !== 'campaigns') {
                    setSelectedCampaignFilter(new Set(selected))
                  }
                  if (t.key === 'campaigns') {
                    setSelectedCampaignFilter(new Set())
                  }
                  setTab(t.key)
                  setSelected(new Set())
                  router.push(`?tab=${t.key}`)
                }}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                {t.label}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Bar - estilo Utmify/Meta */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-[1600px] mx-auto px-6 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Colunas */}
            <div className="relative">
              <button onClick={() => { setShowColumnMenu(!showColumnMenu); setShowGroupMenu(false); setShowDatePicker(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                Colunas
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showColumnMenu && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1">
                  {[
                    { key: 'reach' as const, label: 'Alcance' },
                    { key: 'impressions' as const, label: 'Impressoes' },
                    { key: 'clicks' as const, label: 'Cliques' },
                    { key: 'ctr' as const, label: 'CTR' },
                    { key: 'cpc' as const, label: 'CPC' },
                    { key: 'cpm' as const, label: 'CPM' },
                    { key: 'landingPageViews' as const, label: 'Visitas LP' },
                    { key: 'cpv' as const, label: 'CPV' },
                    { key: 'initiateCheckout' as const, label: 'Init. Checkout' },
                    { key: 'cpi' as const, label: 'CPI' },
                    { key: 'conversions' as const, label: 'Conversoes' },
                    { key: 'cpa' as const, label: 'CPA' },
                    { key: 'conversionValue' as const, label: 'Valor Conv.' },
                    { key: 'roas' as const, label: 'ROAS' },
                  ].map(col => (
                    <button key={col.key} onClick={() => toggleColumn(col.key)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${visibleColumns[col.key] ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                        {visibleColumns[col.key] && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        )}
                      </div>
                      {col.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Detalhamento */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Detalhamento
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {/* Agrupamento */}
            <div className="relative">
              <button onClick={() => { setShowGroupMenu(!showGroupMenu); setShowColumnMenu(false); setShowDatePicker(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                Agrupamento
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showGroupMenu && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1">
                  {['Nenhum', 'Campanha', 'Conjunto de anuncio', 'Anuncio'].map(g => (
                    <button key={g} onClick={() => setShowGroupMenu(false)}
                      className="w-full px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-50">
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="h-5 w-px bg-slate-200 mx-1" />

            {/* Date Picker */}
            <div className="relative">
              <button onClick={() => { setShowDatePicker(!showDatePicker); setShowColumnMenu(false); setShowGroupMenu(false) }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {formatDateRange()}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showDatePicker && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-4">
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1">De</label>
                      <input type="date" value={dateRange.from}
                        onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Ate</label>
                      <input type="date" value={dateRange.to}
                        onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-3 space-y-1">
                    {DATE_PRESETS.map(preset => (
                      <button key={preset.label} onClick={() => applyDatePreset(preset)}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search + Bulk */}
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="max-w-[1600px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              {tab !== 'campaigns' && selectedCampaignFilter.size > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-xs text-blue-600 font-medium">{selectedCampaignFilter.size} campanha(s) filtrada(s)</span>
                  <button onClick={() => { setSelectedCampaignFilter(new Set()); setTab('campaigns') }}
                    className="text-blue-400 hover:text-blue-600">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">{selected.size} selecionado(s)</span>
                  {tab === 'campaigns' && (
                    <button onClick={openDuplicateModal}
                      className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700">Duplicar</button>
                  )}
                  {(tab === 'campaigns' || tab === 'adsets') && (
                    <button onClick={() => setBulkBudgetModalOpen(true)}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700">Alterar Orcamento</button>
                  )}
                  <button onClick={() => handleBulk('ACTIVE')}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700">Ativar</button>
                  <button onClick={() => handleBulk('PAUSED')}
                    className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700">Pausar</button>
                  <button onClick={() => { if (confirm('Tem certeza que deseja excluir?')) handleBulk('DELETED') }}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700">Excluir</button>
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
          <div className="overflow-x-auto light-scrollbar">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10 border-b border-slate-200">
                <tr className="text-left text-slate-500 text-xs uppercase">
                  <th className="w-12 px-4 py-3">
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  </th>
                  <th className="px-4 py-3 min-w-[280px]">Nome</th>
                  <th className="px-4 py-3 w-32">Status</th>
                  {(tab === 'campaigns' || tab === 'adsets') && <th className="px-4 py-3 min-w-[160px]">Orcamento</th>}
                  <th className="px-4 py-3 text-right min-w-[120px]">Gasto</th>
                  {visibleColumns.reach && <th className="px-4 py-3 text-right min-w-[100px]">Alcance</th>}
                  {visibleColumns.impressions && <th className="px-4 py-3 text-right min-w-[110px]">Impressoes</th>}
                  {visibleColumns.clicks && <th className="px-4 py-3 text-right min-w-[100px]">Cliques</th>}
                  {visibleColumns.ctr && <th className="px-4 py-3 text-right min-w-[80px]">CTR</th>}
                  {visibleColumns.cpc && <th className="px-4 py-3 text-right min-w-[100px]">CPC</th>}
                   {visibleColumns.cpm && <th className="px-4 py-3 text-right min-w-[100px]">CPM</th>}
                   {visibleColumns.landingPageViews && <th className="px-4 py-3 text-right min-w-[100px]">Visitas LP</th>}
                   {visibleColumns.cpv && <th className="px-4 py-3 text-right min-w-[100px]">CPV</th>}
                   {visibleColumns.initiateCheckout && <th className="px-4 py-3 text-right min-w-[100px]">Init. Checkout</th>}
                   {visibleColumns.cpi && <th className="px-4 py-3 text-right min-w-[100px]">CPI</th>}
                   {visibleColumns.conversions && <th className="px-4 py-3 text-right min-w-[100px]">Conversoes</th>}
                   {visibleColumns.cpa && <th className="px-4 py-3 text-right min-w-[100px]">CPA</th>}
                  {visibleColumns.conversionValue && <th className="px-4 py-3 text-right min-w-[120px]">Valor Conv.</th>}
                  {visibleColumns.roas && <th className="px-4 py-3 text-right min-w-[100px]">ROAS</th>}
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const id = getId(item)
                  const ins = item.insights || { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0, landing_page_views: 0, initiate_checkout: 0, cpc: null, cpm: null, ctr: null, cpv: null, cpi: null, cpa: null, roas: null }
                  const cpc = ins.clicks > 0 ? ins.spend / ins.clicks : 0
                  const cpm = ins.impressions > 0 ? (ins.spend / ins.impressions) * 1000 : 0
                  const ctr = ins.impressions > 0 ? (ins.clicks / ins.impressions) * 100 : 0
                  const cpv = ins.landing_page_views > 0 ? ins.spend / ins.landing_page_views : 0
                  const cpi = ins.initiate_checkout > 0 ? ins.spend / ins.initiate_checkout : 0
                  const cpa = ins.conversions > 0 ? ins.spend / ins.conversions : 0
                  const roas = ins.spend > 0 ? ins.conversion_value / ins.spend : 0
                  const isToggling = togglingId === id

                  return (
                    <tr key={id} className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${selected.has(id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        {tab === 'campaigns' && (item as CampaignItem).objective && (
                          <div className="text-xs text-slate-400 mt-0.5">{(item as CampaignItem).objective}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleToggle(item, level)} disabled={isToggling} className="focus:outline-none">
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
                        <td className="px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors group"
                          onClick={() => openBudgetEdit(item as CampaignItem | AdSetItem)}>
                          <BudgetDisplay daily={(item as CampaignItem | AdSetItem).daily_budget} lifetime={(item as CampaignItem | AdSetItem).lifetime_budget} />
                          <span className="hidden group-hover:inline ml-1 text-xs text-blue-500">editar</span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-medium">{formatBRL(ins.spend)}</td>
                      {visibleColumns.reach && <td className="px-4 py-3 text-right"><MetricCell value={ins.reach} /></td>}
                      {visibleColumns.impressions && <td className="px-4 py-3 text-right"><MetricCell value={ins.impressions} /></td>}
                      {visibleColumns.clicks && <td className="px-4 py-3 text-right"><MetricCell value={ins.clicks} /></td>}
                      {visibleColumns.ctr && <td className="px-4 py-3 text-right"><MetricCell value={ctr} suffix="%" decimals={2} /></td>}
                      {visibleColumns.cpc && <td className="px-4 py-3 text-right"><MetricCell value={cpc} prefix="R$ " decimals={2} /></td>}
                       {visibleColumns.cpm && <td className="px-4 py-3 text-right"><MetricCell value={cpm} prefix="R$ " decimals={2} /></td>}
                       {visibleColumns.landingPageViews && <td className="px-4 py-3 text-right"><MetricCell value={ins.landing_page_views || 0} /></td>}
                       {visibleColumns.cpv && <td className="px-4 py-3 text-right"><MetricCell value={cpv} prefix="R$ " decimals={2} /></td>}
                       {visibleColumns.initiateCheckout && <td className="px-4 py-3 text-right"><MetricCell value={ins.initiate_checkout || 0} /></td>}
                       {visibleColumns.cpi && <td className="px-4 py-3 text-right"><MetricCell value={cpi} prefix="R$ " decimals={2} /></td>}
                       {visibleColumns.conversions && <td className="px-4 py-3 text-right"><MetricCell value={ins.conversions} /></td>}
                       {visibleColumns.cpa && <td className="px-4 py-3 text-right"><MetricCell value={cpa} prefix="R$ " decimals={2} /></td>}
                      {visibleColumns.conversionValue && (
                        <td className="px-4 py-3 text-right font-medium text-emerald-600">
                          <MetricCell value={ins.conversion_value} prefix="R$ " decimals={2} />
                        </td>
                      )}
                      {visibleColumns.roas && (
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${roas >= 1 ? 'text-emerald-600' : roas > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            <MetricCell value={roas} suffix="x" decimals={2} />
                          </span>
                        </td>
                      )}
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

      {/* Duplicate Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDuplicateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Duplicar Campanha{selected.size > 1 ? 's' : ''}</h2>
                <button onClick={() => setShowDuplicateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Conta de destino</label>
                <select value={duplicateTarget} onChange={e => setDuplicateTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Mesma conta</option>
                  {accounts.filter(a => a.ad_account_id !== accountId).map(a => (
                    <option key={a.ad_account_id} value={a.ad_account_id}>{a.ad_account_name || a.ad_account_id}</option>
                  ))}
                </select>
                {!duplicateTarget && <p className="text-xs text-slate-400 mt-1">A campanha sera criada nesta mesma conta</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                  <input type="number" min={1} max={duplicateLimit?.max_copies || 20} value={duplicateQuantity}
                    onChange={e => setDuplicateQuantity(Math.min(duplicateLimit?.max_copies || 20, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {duplicateLimit ? (
                    <p className="text-xs text-slate-400 mt-1">Max. {duplicateLimit.max_copies} copias</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">Carregando...</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sufixo (opcional)</label>
                  <input type="text" value={duplicateNameSuffix} onChange={e => setDuplicateNameSuffix(e.target.value)}
                    placeholder="Ex: Copy"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-slate-400 mt-1">Ex: &quot;Nome - Copia 1&quot;</p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={duplicateStartPaused}
                  onChange={e => setDuplicateStartPaused(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-slate-700">Criar pausada (recomendado)</span>
              </label>
              {duplicateLimit && (
                <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-500 space-y-0.5">
                  <p>{duplicateLimit.ad_sets} conjunto(s) de anuncio(s), {duplicateLimit.total_ads} anuncio(s)</p>
                  <p>{duplicateLimit.api_cost_per_copy} chamadas API por copia</p>
                  <p>Limite: 1.000 chamadas/operacao (25% do limite horario)</p>
                </div>
              )}
              <p className="text-xs text-slate-400">Campanhas, conjuntos, anuncios e criativos serao copiados.</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button onClick={() => setShowDuplicateModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleDuplicate} disabled={duplicating}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {duplicating ? 'Duplicando...' : `Duplicar ${selected.size > 1 ? `${selected.size} campanhas` : 'campanha'}${duplicateQuantity > 1 ? ` x${duplicateQuantity}` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Budget Edit Modal */}
      {budgetModalOpen && budgetEditItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setBudgetModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Alterar Orcamento</h2>
              <p className="text-sm text-slate-500 mt-1">{budgetEditItem.name}</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setBudgetType('daily')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${budgetType === 'daily' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Diario
                </button>
                <button onClick={() => setBudgetType('lifetime')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${budgetType === 'lifetime' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Total
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
                <input type="number" step="0.01" min="0" value={budgetValue}
                  onChange={e => setBudgetValue(e.target.value)}
                  placeholder="Ex: 50.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button onClick={() => setBudgetModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleSaveBudget} disabled={savingBudget || !budgetValue}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {savingBudget ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Budget Edit Modal */}
      {bulkBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setBulkBudgetModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Alterar Orcamento em Lote</h2>
              <p className="text-sm text-slate-500 mt-1">{selected.size} item(ns) selecionado(s)</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setBulkBudgetAction('increase')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${bulkBudgetAction === 'increase' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Aumentar %
                </button>
                <button onClick={() => setBulkBudgetAction('decrease')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${bulkBudgetAction === 'decrease' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Diminuir %
                </button>
                <button onClick={() => setBulkBudgetAction('set')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${bulkBudgetAction === 'set' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Definir R$
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {bulkBudgetAction === 'set' ? 'Novo valor (R$)' : 'Percentual (%)'}
                </label>
                <input type="number" step="0.01" min="0" value={bulkBudgetAmount}
                  onChange={e => setBulkBudgetAmount(e.target.value)}
                  placeholder={bulkBudgetAction === 'set' ? 'Ex: 50.00' : 'Ex: 20'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setBulkBudgetType('daily')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${bulkBudgetType === 'daily' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Diario
                </button>
                <button onClick={() => setBulkBudgetType('lifetime')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${bulkBudgetType === 'lifetime' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Total
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button onClick={() => setBulkBudgetModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleBulkBudget} disabled={savingBulkBudget || !bulkBudgetAmount}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {savingBulkBudget ? 'Aplicando...' : 'Aplicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
