'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
      isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-surface text-muted'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-muted'}`} />
      {isActive ? 'Ativo' : 'Pausado'}
    </span>
  )
}

function BudgetDisplay({ daily, lifetime }: { daily?: string | number; lifetime?: string | number }) {
  const d = typeof daily === 'string' ? parseFloat(daily) : (daily || 0)
  const l = typeof lifetime === 'string' ? parseFloat(lifetime) : (lifetime || 0)
  if (d > 0) return <span className="text-sm">{formatBRL(d / 100)}/dia</span>
  if (l > 0) return <span className="text-sm">{formatBRL(l / 100)} total</span>
  return <span className="text-muted text-sm">Sem limite</span>
}

function MetricCell({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number
}) {
  if (value === 0) return <span className="text-muted">&mdash;</span>
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return <span>{prefix}{formatted}{suffix}</span>
}

function todayBr(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

function formatBr(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

function getDefaultDateRange() {
  const now = new Date()
  const from = new Date(now.getTime() - 30 * 86400000)
  return { from: formatBr(from), to: todayBr() }
}

const DATE_PRESETS = [
  { label: 'Ultimos 7 dias', days: 7 },
  { label: 'Ultimos 14 dias', days: 14 },
  { label: 'Ultimos 30 dias', days: 30 },
  { label: 'Ultimos 90 dias', days: 90 },
  { label: 'Este mes', days: 'month' as const },
  { label: 'Mes passado', days: 'lastmonth' as const },
]

export default function CampaignManagementPageInner() {
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
    budget: true,
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

  const COL_MIN_WIDTH = 60
  const COL_MAX_WIDTH = 300
  const DEFAULT_COL_WIDTH = 130

  const DEFAULT_COLUMN_ORDER: string[] = [
    'spend', 'budget', 'reach', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm',
    'landingPageViews', 'cpv', 'initiateCheckout', 'cpi', 'conversions',
    'cpa', 'conversionValue', 'roas'
  ]

  const COLUMN_LABELS: Record<string, string> = {
    spend: 'Gasto',
    budget: 'Orcamento',
    reach: 'Alcance',
    impressions: 'Impressoes',
    clicks: 'Cliques',
    ctr: 'CTR',
    cpc: 'CPC',
    cpm: 'CPM',
    landingPageViews: 'Visitas LP',
    cpv: 'CPV',
    initiateCheckout: 'Init. Checkout',
    cpi: 'CPI',
    conversions: 'Conversoes',
    cpa: 'CPA',
    conversionValue: 'Valor Conv.',
    roas: 'ROAS',
  }

  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    DEFAULT_COLUMN_ORDER.forEach(key => { initial[key] = DEFAULT_COL_WIDTH })
    return initial
  })

  const [resizing, setResizing] = useState<{ key: string; startX: number; startWidth: number } | null>(null)
  const [draggingCol, setDraggingCol] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

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
      setDateRange({ from: formatBr(from), to: formatBr(to) })
      setShowDatePicker(false)
      return
    } else {
      from = new Date(now.getTime() - (preset.days as number) * 86400000)
    }
    setDateRange({ from: formatBr(from), to: todayBr() })
    setShowDatePicker(false)
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { fetchData() }, [fetchData])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!resizing) return
    const onMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizing.startX
      const newWidth = Math.max(COL_MIN_WIDTH, Math.min(COL_MAX_WIDTH, resizing.startWidth + diff))
      setColumnWidths(prev => ({ ...prev, [resizing.key]: newWidth }))
    }
    const onMouseUp = () => setResizing(null)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizing])

  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem('campaign-table-column-order')
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder) as string[]
        const unique: string[] = []
        parsed.forEach(key => { if (!unique.includes(key) && DEFAULT_COLUMN_ORDER.includes(key)) unique.push(key) })
        DEFAULT_COLUMN_ORDER.forEach(key => { if (!unique.includes(key)) unique.push(key) })
        setColumnOrder(unique)
      }
      const savedWidths = localStorage.getItem('campaign-table-column-widths')
      if (savedWidths) {
        setColumnWidths(JSON.parse(savedWidths))
      }
    } catch {}
  }, [])

  const orderSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const widthsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (orderSaveTimer.current) clearTimeout(orderSaveTimer.current)
    orderSaveTimer.current = setTimeout(() => {
      localStorage.setItem('campaign-table-column-order', JSON.stringify(columnOrder))
    }, 300)
    return () => { if (orderSaveTimer.current) clearTimeout(orderSaveTimer.current) }
  }, [columnOrder])

  useEffect(() => {
    if (widthsSaveTimer.current) clearTimeout(widthsSaveTimer.current)
    widthsSaveTimer.current = setTimeout(() => {
      localStorage.setItem('campaign-table-column-widths', JSON.stringify(columnWidths))
    }, 300)
    return () => { if (widthsSaveTimer.current) clearTimeout(widthsSaveTimer.current) }
  }, [columnWidths])

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

  const subtotal = filtered.reduce((acc, item) => {
    const ins = item.insights || { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0, landing_page_views: 0, initiate_checkout: 0, cpc: null, cpm: null, ctr: null, cpv: null, cpi: null, cpa: null, roas: null }
    acc.spend += ins.spend || 0
    acc.reach += ins.reach || 0
    acc.impressions += ins.impressions || 0
    acc.clicks += ins.clicks || 0
    acc.conversions += ins.conversions || 0
    acc.conversion_value += ins.conversion_value || 0
    acc.landing_page_views += ins.landing_page_views || 0
    acc.initiate_checkout += ins.initiate_checkout || 0
    return acc
  }, { spend: 0, reach: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0, landing_page_views: 0, initiate_checkout: 0 })

  const subCtr = subtotal.impressions > 0 ? (subtotal.clicks / subtotal.impressions) * 100 : 0
  const subCpc = subtotal.clicks > 0 ? subtotal.spend / subtotal.clicks : 0
  const subCpm = subtotal.impressions > 0 ? (subtotal.spend / subtotal.impressions) * 1000 : 0
  const subCpv = subtotal.landing_page_views > 0 ? subtotal.spend / subtotal.landing_page_views : 0
  const subCpi = subtotal.initiate_checkout > 0 ? subtotal.spend / subtotal.initiate_checkout : 0
  const subCpa = subtotal.conversions > 0 ? subtotal.spend / subtotal.conversions : 0
  const subRoas = subtotal.spend > 0 ? subtotal.conversion_value / subtotal.spend : 0

  const isMetricVisible = (key: string) => {
    if (key === 'spend') return true
    if (key === 'budget') return !!visibleColumns.budget && (tab === 'campaigns' || tab === 'adsets')
    return !!(visibleColumns as Record<string, boolean>)[key]
  }

  const handleResizeStart = (key: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setResizing({ key, startX: e.clientX, startWidth: columnWidths[key] || DEFAULT_COL_WIDTH })
  }

  const handleDragStart = (key: string) => setDraggingCol(key)
  const handleDragOver = (e: React.DragEvent, key: string) => { e.preventDefault(); setDragOverCol(key) }
  const handleDragEnd = () => { setDraggingCol(null); setDragOverCol(null) }
  const handleDrop = (targetKey: string) => {
    if (draggingCol && draggingCol !== targetKey) {
      const newOrder = [...columnOrder]
      const fromIdx = newOrder.indexOf(draggingCol)
      const toIdx = newOrder.indexOf(targetKey)
      if (fromIdx === -1 || toIdx === -1) return
      newOrder.splice(fromIdx, 1)
      const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx
      newOrder.splice(insertIdx, 0, draggingCol)
      setColumnOrder(newOrder)
    }
    setDraggingCol(null)
    setDragOverCol(null)
  }

  const resetColumns = () => {
    setColumnOrder(DEFAULT_COLUMN_ORDER)
    const initial: Record<string, number> = {}
    DEFAULT_COLUMN_ORDER.forEach(key => { initial[key] = DEFAULT_COL_WIDTH })
    setColumnWidths(initial)
  }

  const visibleMetricColumns = columnOrder.filter(key => isMetricVisible(key))

  function renderMetricCell(key: string, _item: CampaignItem | AdSetItem | AdItem, ins: Insights, computed: { cpc: number; cpm: number; ctr: number; cpv: number; cpi: number; cpa: number; roas: number }): React.ReactNode {
    switch (key) {
      case 'spend':
        return <span className="font-medium">{formatBRL(ins.spend)}</span>
      case 'budget':
        return <BudgetDisplay daily={(_item as CampaignItem | AdSetItem).daily_budget} lifetime={(_item as CampaignItem | AdSetItem).lifetime_budget} />
      case 'reach':
        return <MetricCell value={ins.reach} />
      case 'impressions':
        return <MetricCell value={ins.impressions} />
      case 'clicks':
        return <MetricCell value={ins.clicks} />
      case 'ctr':
        return <MetricCell value={computed.ctr} suffix="%" decimals={2} />
      case 'cpc':
        return <MetricCell value={computed.cpc} prefix="R$ " decimals={2} />
      case 'cpm':
        return <MetricCell value={computed.cpm} prefix="R$ " decimals={2} />
      case 'landingPageViews':
        return <MetricCell value={ins.landing_page_views || 0} />
      case 'cpv':
        return <MetricCell value={computed.cpv} prefix="R$ " decimals={2} />
      case 'initiateCheckout':
        return <MetricCell value={ins.initiate_checkout || 0} />
      case 'cpi':
        return <MetricCell value={computed.cpi} prefix="R$ " decimals={2} />
      case 'conversions':
        return <MetricCell value={ins.conversions} />
      case 'cpa':
        return <MetricCell value={computed.cpa} prefix="R$ " decimals={2} />
      case 'conversionValue':
        return <span className="font-medium text-emerald-600"><MetricCell value={ins.conversion_value} prefix="R$ " decimals={2} /></span>
      case 'roas':
        return (
          <span className={`font-semibold ${computed.roas >= 1 ? 'text-emerald-600' : computed.roas > 0 ? 'text-amber-600' : 'text-muted'}`}>
            <MetricCell value={computed.roas} suffix="x" decimals={2} />
          </span>
        )
      default:
        return null
    }
  }

  function renderSubtotalCell(key: string): React.ReactNode {
    switch (key) {
      case 'spend':
        return <span className="font-bold">{formatBRL(subtotal.spend)}</span>
      case 'budget':
        return null
      case 'reach':
        return <span className="font-semibold">{subtotal.reach.toLocaleString('pt-BR')}</span>
      case 'impressions':
        return <span className="font-semibold">{subtotal.impressions.toLocaleString('pt-BR')}</span>
      case 'clicks':
        return <span className="font-semibold">{subtotal.clicks.toLocaleString('pt-BR')}</span>
      case 'ctr':
        return <span className="font-semibold">{subCtr.toFixed(2)}%</span>
      case 'cpc':
        return <span className="font-semibold">R$ {subCpc.toFixed(2)}</span>
      case 'cpm':
        return <span className="font-semibold">R$ {subCpm.toFixed(2)}</span>
      case 'landingPageViews':
        return <span className="font-semibold">{subtotal.landing_page_views.toLocaleString('pt-BR')}</span>
      case 'cpv':
        return <span className="font-semibold">R$ {subCpv.toFixed(2)}</span>
      case 'initiateCheckout':
        return <span className="font-semibold">{subtotal.initiate_checkout.toLocaleString('pt-BR')}</span>
      case 'cpi':
        return <span className="font-semibold">R$ {subCpi.toFixed(2)}</span>
      case 'conversions':
        return <span className="font-semibold">{subtotal.conversions.toLocaleString('pt-BR')}</span>
      case 'cpa':
        return <span className="font-semibold">R$ {subCpa.toFixed(2)}</span>
      case 'conversionValue':
        return <span className="font-bold text-emerald-600">{formatBRL(subtotal.conversion_value)}</span>
      case 'roas':
        return (
          <span className={`font-bold ${subRoas >= 1 ? 'text-emerald-600' : subRoas > 0 ? 'text-amber-600' : 'text-muted'}`}>
            {subRoas.toFixed(2)}x
          </span>
        )
      default:
        return null
    }
  }

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
    <div className="min-h-screen bg-card">
      <div className="border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link href="/dashboard/ads" className="text-muted hover:text-muted transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-base font-bold text-foreground sm:text-lg">Gestao de Campanhas</h1>
                <p className="text-xs text-muted sm:text-sm truncate max-w-[200px] sm:max-w-none">{accountId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href={`/dashboard/ads/${accountId}/rules`}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground text-sm font-semibold rounded-lg hover:bg-surface transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Regras
              </Link>
              <button onClick={handleSync} disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors sm:gap-2 sm:px-4 sm:text-sm">
              {isSyncing ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="hidden sm:inline">Sincronizando...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync
                </>
              )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="-mb-px flex gap-0 overflow-x-auto">
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
                className={`whitespace-nowrap px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors sm:px-5 sm:py-3 sm:text-sm ${
                  tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted hover:text-foreground'
                }`}>
                {t.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] sm:ml-2 sm:px-2 sm:text-xs ${tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-surface text-muted'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Bar - estilo Utmify/Meta */}
      <div className="border-b border-border bg-card">
        <div className="max-w-[1600px] mx-auto px-4 py-2 sm:px-6">
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {/* Colunas */}
            <div className="relative">
              <button onClick={() => { setShowColumnMenu(!showColumnMenu); setShowGroupMenu(false); setShowDatePicker(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-surface transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                Colunas
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
                  {showColumnMenu && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-50 py-1">
                  {[
                    { key: 'budget' as const, label: 'Orcamento' },
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
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-surface">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${visibleColumns[col.key] ? 'bg-blue-600 border-blue-600' : 'border-border'}`}>
                        {visibleColumns[col.key] && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        )}
                      </div>
                      {col.label}
                    </button>
                  ))}
                  <div className="border-t border-border mt-1 pt-1">
                    <button onClick={() => { resetColumns(); setShowColumnMenu(false) }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted hover:bg-surface">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      Restaurar colunas
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Detalhamento */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-surface transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Detalhamento
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {/* Agrupamento */}
            <div className="relative">
              <button onClick={() => { setShowGroupMenu(!showGroupMenu); setShowColumnMenu(false); setShowDatePicker(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-surface transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                Agrupamento
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showGroupMenu && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-card border border-border rounded-xl shadow-lg z-50 py-1">
                  {['Nenhum', 'Campanha', 'Conjunto de anuncio', 'Anuncio'].map(g => (
                    <button key={g} onClick={() => setShowGroupMenu(false)}
                      className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-surface">
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="h-5 w-px bg-surface mx-1" />

            {/* Date Picker */}
            <div className="relative">
              <button onClick={() => { setShowDatePicker(!showDatePicker); setShowColumnMenu(false); setShowGroupMenu(false) }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-surface transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {formatDateRange()}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showDatePicker && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-xl shadow-lg z-50 p-4">
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-muted mb-1">De</label>
                      <input type="date" value={dateRange.from}
                        onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                        className="w-full px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-muted mb-1">Ate</label>
                      <input type="date" value={dateRange.to}
                        onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                        className="w-full px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="border-t border-border pt-3 space-y-1">
                    {DATE_PRESETS.map(preset => (
                      <button key={preset.label} onClick={() => applyDatePreset(preset)}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-surface rounded-lg transition-colors">
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
      <div className="border-b border-border bg-surface">
        <div className="max-w-[1600px] mx-auto px-4 py-2 sm:px-6 sm:py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-none">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:w-64" />
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
                <div className="flex items-center gap-1.5 overflow-x-auto sm:gap-2">
                  <span className="shrink-0 text-xs text-muted sm:text-sm">{selected.size} sel.</span>
                  {tab === 'campaigns' && (
                    <button onClick={openDuplicateModal}
                      className="shrink-0 px-2.5 py-1 bg-purple-600 text-white text-[11px] font-semibold rounded-lg hover:bg-purple-700 sm:px-3 sm:text-xs">Duplicar</button>
                  )}
                  {(tab === 'campaigns' || tab === 'adsets') && (
                    <button onClick={() => setBulkBudgetModalOpen(true)}
                      className="shrink-0 px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-semibold rounded-lg hover:bg-indigo-700 sm:px-3 sm:text-xs">Orcamento</button>
                  )}
                  <button onClick={() => handleBulk('ACTIVE')}
                    className="shrink-0 px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-semibold rounded-lg hover:bg-emerald-700 sm:px-3 sm:text-xs">Ativar</button>
                  <button onClick={() => handleBulk('PAUSED')}
                    className="shrink-0 px-2.5 py-1 bg-amber-600 text-white text-[11px] font-semibold rounded-lg hover:bg-amber-700 sm:px-3 sm:text-xs">Pausar</button>
                  <button onClick={() => { if (confirm('Tem certeza que deseja excluir?')) handleBulk('DELETED') }}
                    className="shrink-0 px-2.5 py-1 bg-red-600 text-white text-[11px] font-semibold rounded-lg hover:bg-red-700 sm:px-3 sm:text-xs">Excluir</button>
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
            <div className="flex items-center gap-3 text-muted">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Carregando dados...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
            <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm">Nenhum item encontrado</p>
            <p className="text-xs mt-1">Clique em Sync para carregar dados do Meta</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto light-scrollbar">
              <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <thead className="sticky top-0 bg-card z-10 border-b border-border">
                <tr className="text-left text-muted text-xs uppercase">
                  <th className="px-4 py-3 shrink-0" style={{ width: 48 }}>
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll} className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500" />
                  </th>
                  <th className="px-4 py-3 shrink-0" style={{ width: 300 }}>Nome</th>
                  <th className="px-4 py-3 shrink-0" style={{ width: 110 }}>Status</th>
                  {visibleMetricColumns.map(key => (
                    <th key={key}
                      draggable
                      onDragStart={() => handleDragStart(key)}
                      onDragOver={(e) => handleDragOver(e, key)}
                      onDragEnd={handleDragEnd}
                      onDrop={() => handleDrop(key)}
                      className={`px-4 py-3 text-right relative group shrink-0 select-none ${dragOverCol === key && draggingCol !== key ? 'bg-blue-50' : ''} ${draggingCol === key ? 'opacity-50' : ''}`}
                      style={{ width: columnWidths[key] || DEFAULT_COL_WIDTH, minWidth: COL_MIN_WIDTH }}>
                      <span className="cursor-grab active:cursor-grabbing">{COLUMN_LABELS[key]}</span>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500 z-10"
                        onMouseDown={(e) => handleResizeStart(key, e)}
                      />
                    </th>
                  ))}
                  <th className="px-4 py-3 shrink-0" style={{ width: 56 }}></th>
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
                    <tr key={id} className={`border-t border-border hover:bg-surface transition-colors ${selected.has(id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3" style={{ width: 48 }}>
                        <input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)}
                          className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500" />
                      </td>
                      <td className="px-4 py-3" style={{ width: 300 }}>
                        <div className="font-semibold text-foreground">{item.name}</div>
                        {tab === 'campaigns' && (item as CampaignItem).objective && (
                          <div className="text-xs text-muted mt-0.5">{(item as CampaignItem).objective}</div>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ width: 110 }}>
                        <button onClick={() => handleToggle(item, level)} disabled={isToggling} className="focus:outline-none">
                          {isToggling ? (
                            <svg className="animate-spin w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <StatusBadge status={item.status} />
                          )}
                        </button>
                      </td>
                       {visibleMetricColumns.map(key => (
                        <td key={key}
                          className={`px-4 py-3 text-right ${key === 'budget' ? 'cursor-pointer hover:bg-blue-50 transition-colors group' : ''}`}
                          style={{ width: columnWidths[key] || DEFAULT_COL_WIDTH, minWidth: COL_MIN_WIDTH }}
                          onClick={key === 'budget' ? () => openBudgetEdit(item as CampaignItem | AdSetItem) : undefined}>
                          {key === 'budget' ? (
                            <>
                              <span className="text-blue-600"><BudgetDisplay daily={(item as CampaignItem | AdSetItem).daily_budget} lifetime={(item as CampaignItem | AdSetItem).lifetime_budget} /></span>
                              <span className="hidden group-hover:inline ml-1 text-xs text-blue-500">editar</span>
                            </>
                          ) : (
                            renderMetricCell(key, item, ins, { cpc, cpm, ctr, cpv, cpi, cpa, roas })
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3" style={{ width: 56 }}>
                        <button className="text-muted hover:text-muted">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length > 0 && (
                  <tr className="border-t-2 border-blue-200 bg-blue-50/50 text-sm">
                    <td className="px-4 py-3 shrink-0" style={{ width: 48 }}>
                      <span className="text-xs font-bold text-foreground uppercase">Total</span>
                    </td>
                    <td className="px-4 py-3 shrink-0" style={{ width: 300 }}>
                      <span className="text-xs text-muted">({filtered.length} itens)</span>
                    </td>
                    <td className="px-4 py-3 shrink-0" style={{ width: 110 }}></td>
                    {visibleMetricColumns.map(key => (
                      <td key={key}
                        className="px-4 py-3 text-right text-sm"
                        style={{ width: columnWidths[key] || DEFAULT_COL_WIDTH, minWidth: COL_MIN_WIDTH }}>
                        {renderSubtotalCell(key)}
                      </td>
                    ))}
                    <td className="px-4 py-3 shrink-0" style={{ width: 56 }}></td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 px-4 py-2 md:hidden">
              {filtered.map((item) => {
                const id = getId(item)
                const ins = item.insights || { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0, landing_page_views: 0, initiate_checkout: 0, cpc: null, cpm: null, ctr: null, cpv: null, cpi: null, cpa: null, roas: null }
                const cpc = ins.clicks > 0 ? ins.spend / ins.clicks : 0
                const ctr = ins.impressions > 0 ? (ins.clicks / ins.impressions) * 100 : 0
                const cpa = ins.conversions > 0 ? ins.spend / ins.conversions : 0
                const roas = ins.spend > 0 ? ins.conversion_value / ins.spend : 0
                const isToggling = togglingId === id

                return (
                  <div key={id} className={`rounded-xl border border-border bg-card p-3 ${selected.has(id) ? 'ring-2 ring-blue-500' : ''}`}>
                    <div className="flex items-start gap-2.5">
                      <input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-border text-blue-600" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
                            {tab === 'campaigns' && (item as CampaignItem).objective && (
                              <p className="text-[11px] text-muted">{(item as CampaignItem).objective}</p>
                            )}
                          </div>
                          <button onClick={() => handleToggle(item, level)} disabled={isToggling} className="shrink-0 focus:outline-none">
                            {isToggling ? (
                              <svg className="animate-spin h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <StatusBadge status={item.status} />
                            )}
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <p className="text-muted">Gasto</p>
                            <p className="font-semibold text-foreground">{formatBRL(ins.spend)}</p>
                          </div>
                          <div>
                            <p className="text-muted">Cliques</p>
                            <p className="font-semibold text-foreground">{ins.clicks.toLocaleString('pt-BR')}</p>
                          </div>
                          <div>
                            <p className="text-muted">CTR</p>
                            <p className="font-semibold text-foreground">{ctr > 0 ? `${ctr.toFixed(2)}%` : '—'}</p>
                          </div>
                          <div>
                            <p className="text-muted">Impress.</p>
                            <p className="font-semibold text-foreground">{ins.impressions.toLocaleString('pt-BR')}</p>
                          </div>
                          <div>
                            <p className="text-muted">Conv.</p>
                            <p className="font-semibold text-emerald-600">{ins.conversions}</p>
                          </div>
                          <div>
                            <p className="text-muted">ROAS</p>
                            <p className={`font-semibold ${roas >= 1 ? 'text-emerald-600' : roas > 0 ? 'text-amber-600' : 'text-muted'}`}>
                              {roas > 0 ? `${roas.toFixed(2)}x` : '—'}
                            </p>
                          </div>
                        </div>
                        {(tab === 'campaigns' || tab === 'adsets') && (
                          <div className="mt-2 flex items-center gap-2 text-[11px]">
                            <span className="text-muted">Orc.:</span>
                            <button onClick={() => openBudgetEdit(item as CampaignItem | AdSetItem)}
                              className="font-medium text-blue-600 hover:underline">
                              <BudgetDisplay daily={(item as CampaignItem | AdSetItem).daily_budget} lifetime={(item as CampaignItem | AdSetItem).lifetime_budget} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {filtered.length > 0 && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Total ({filtered.length} itens)</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-muted">Gasto</p>
                      <p className="font-bold text-foreground">{formatBRL(subtotal.spend)}</p>
                    </div>
                    <div>
                      <p className="text-muted">Cliques</p>
                      <p className="font-bold text-foreground">{subtotal.clicks.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-muted">CTR</p>
                      <p className="font-bold text-foreground">{subCtr.toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-muted">Conv.</p>
                      <p className="font-bold text-emerald-600">{subtotal.conversions}</p>
                    </div>
                    <div>
                      <p className="text-muted">ROAS</p>
                      <p className={`font-bold ${subRoas >= 1 ? 'text-emerald-600' : subRoas > 0 ? 'text-amber-600' : 'text-muted'}`}>
                        {subRoas > 0 ? `${subRoas.toFixed(2)}x` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted">Valor Conv.</p>
                      <p className="font-bold text-emerald-600">{formatBRL(subtotal.conversion_value)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Duplicate Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDuplicateModal(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">Duplicar Campanha{selected.size > 1 ? 's' : ''}</h2>
                <button onClick={() => setShowDuplicateModal(false)} className="text-muted hover:text-muted">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Conta de destino</label>
                <select value={duplicateTarget} onChange={e => setDuplicateTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Mesma conta</option>
                  {accounts.filter(a => a.ad_account_id !== accountId).map(a => (
                    <option key={a.ad_account_id} value={a.ad_account_id}>{a.ad_account_name || a.ad_account_id}</option>
                  ))}
                </select>
                {!duplicateTarget && <p className="text-xs text-muted mt-1">A campanha sera criada nesta mesma conta</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Quantidade</label>
                  <input type="number" min={1} max={duplicateLimit?.max_copies || 20} value={duplicateQuantity}
                    onChange={e => setDuplicateQuantity(Math.min(duplicateLimit?.max_copies || 20, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {duplicateLimit ? (
                    <p className="text-xs text-muted mt-1">Max. {duplicateLimit.max_copies} copias</p>
                  ) : (
                    <p className="text-xs text-muted mt-1">Carregando...</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Sufixo (opcional)</label>
                  <input type="text" value={duplicateNameSuffix} onChange={e => setDuplicateNameSuffix(e.target.value)}
                    placeholder="Ex: Copy"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-muted mt-1">Ex: &quot;Nome - Copia 1&quot;</p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={duplicateStartPaused}
                  onChange={e => setDuplicateStartPaused(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-foreground">Criar pausada (recomendado)</span>
              </label>
              {duplicateLimit && (
                <div className="bg-surface rounded-lg px-3 py-2 text-xs text-muted space-y-0.5">
                  <p>{duplicateLimit.ad_sets} conjunto(s) de anuncio(s), {duplicateLimit.total_ads} anuncio(s)</p>
                  <p>{duplicateLimit.api_cost_per_copy} chamadas API por copia</p>
                  <p>Limite: 1.000 chamadas/operacao (25% do limite horario)</p>
                </div>
              )}
              <p className="text-xs text-muted">Campanhas, conjuntos, anuncios e criativos serao copiados.</p>
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <button onClick={() => setShowDuplicateModal(false)}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-surface rounded-lg transition-colors">Cancelar</button>
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
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">Alterar Orcamento</h2>
              <p className="text-sm text-muted mt-1">{budgetEditItem.name}</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setBudgetType('daily')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${budgetType === 'daily' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-border text-muted hover:bg-surface'}`}>
                  Diario
                </button>
                <button onClick={() => setBudgetType('lifetime')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${budgetType === 'lifetime' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-border text-muted hover:bg-surface'}`}>
                  Total
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Valor (R$)</label>
                <input type="number" step="0.01" min="0" value={budgetValue}
                  onChange={e => setBudgetValue(e.target.value)}
                  placeholder="Ex: 50.00"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <button onClick={() => setBudgetModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-surface rounded-lg transition-colors">Cancelar</button>
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
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">Alterar Orcamento em Lote</h2>
              <p className="text-sm text-muted mt-1">{selected.size} item(ns) selecionado(s)</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setBulkBudgetAction('increase')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${bulkBudgetAction === 'increase' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-border text-muted hover:bg-surface'}`}>
                  Aumentar %
                </button>
                <button onClick={() => setBulkBudgetAction('decrease')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${bulkBudgetAction === 'decrease' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-border text-muted hover:bg-surface'}`}>
                  Diminuir %
                </button>
                <button onClick={() => setBulkBudgetAction('set')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${bulkBudgetAction === 'set' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-border text-muted hover:bg-surface'}`}>
                  Definir R$
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {bulkBudgetAction === 'set' ? 'Novo valor (R$)' : 'Percentual (%)'}
                </label>
                <input type="number" step="0.01" min="0" value={bulkBudgetAmount}
                  onChange={e => setBulkBudgetAmount(e.target.value)}
                  placeholder={bulkBudgetAction === 'set' ? 'Ex: 50.00' : 'Ex: 20'}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setBulkBudgetType('daily')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${bulkBudgetType === 'daily' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-border text-muted hover:bg-surface'}`}>
                  Diario
                </button>
                <button onClick={() => setBulkBudgetType('lifetime')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${bulkBudgetType === 'lifetime' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-border text-muted hover:bg-surface'}`}>
                  Total
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <button onClick={() => setBulkBudgetModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-surface rounded-lg transition-colors">Cancelar</button>
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