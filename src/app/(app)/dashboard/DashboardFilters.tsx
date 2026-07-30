'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, Check, X } from 'lucide-react'

function getDefaultDateRange() {
  const now = new Date()
  const from = new Date(now.getTime() - 30 * 86400000)
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
}

const DATE_PRESETS = [
  { label: 'Hoje', days: 0 },
  { label: 'Últimos 7 dias', days: 7 },
  { label: 'Últimos 14 dias', days: 14 },
  { label: 'Últimos 30 dias', days: 30 },
  { label: 'Últimos 90 dias', days: 90 },
  { label: 'Este mês', days: 'month' as const },
  { label: 'Mês passado', days: 'lastmonth' as const },
]

function formatDateRange(from: string, to: string) {
  const fmt = (d: string) => {
    const [y, m, day] = d.split('-')
    return `${day}/${m}`
  }
  return `${fmt(from)} – ${fmt(to)}`
}

function applyDatePreset(preset: typeof DATE_PRESETS[number]): { from: string; to: string } {
  const now = new Date()
  let from: Date
  if (preset.days === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (preset.days === 'lastmonth') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
  } else if (preset.days === 0) {
    const today = now.toISOString().slice(0, 10)
    return { from: today, to: today }
  } else {
    from = new Date(now.getTime() - (preset.days as number) * 86400000)
  }
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
}

type CampaignOption = { campaign_id: string; name: string }

interface DashboardFiltersProps {
  dateRange: { from: string; to: string }
  onDateRangeChange: (range: { from: string; to: string }) => void
  selectedCampaigns: Set<string> | null
  onCampaignsChange: (ids: Set<string> | null) => void
  campaigns: CampaignOption[]
}

export function DashboardFilters({
  dateRange,
  onDateRangeChange,
  selectedCampaigns,
  onCampaignsChange,
  campaigns,
}: DashboardFiltersProps) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showCampaignPicker, setShowCampaignPicker] = useState(false)
  const dateRef = useRef<HTMLDivElement>(null)
  const campaignRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setShowDatePicker(false)
      if (campaignRef.current && !campaignRef.current.contains(e.target as Node)) setShowCampaignPicker(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activePreset = DATE_PRESETS.find(p => {
    const applied = applyDatePreset(p)
    return applied.from === dateRange.from && applied.to === dateRange.to
  })

  const hasCampaignFilter = selectedCampaigns !== null && selectedCampaigns.size > 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date Presets */}
      <div className="flex items-center gap-1">
        {DATE_PRESETS.map(preset => (
          <button
            key={preset.label}
            onClick={() => onDateRangeChange(applyDatePreset(preset))}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activePreset?.label === preset.label
                ? 'bg-orange-500 text-white'
                : 'bg-card text-muted border border-border hover:bg-surface'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      <div className="relative" ref={dateRef}>
        <button
          onClick={() => { setShowDatePicker(!showDatePicker); setShowCampaignPicker(false) }}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-muted bg-card border border-border rounded-lg hover:bg-surface transition"
        >
          <Calendar className="w-3.5 h-3.5" />
          {formatDateRange(dateRange.from, dateRange.to)}
          <ChevronDown className="w-3 h-3" />
        </button>
        {showDatePicker && (
          <div className="absolute top-full left-0 mt-1 w-80 bg-card border border-border rounded-xl shadow-xl z-50 p-5">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Período personalizado</p>
            <div className="flex gap-3 mb-5">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-muted mb-1.5">De</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={e => onDateRangeChange({ ...dateRange, from: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-background text-foreground [color-scheme:dark]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-muted mb-1.5">Até</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={e => onDateRangeChange({ ...dateRange, to: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-background text-foreground [color-scheme:dark]"
                />
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Atalhos</p>
              <div className="grid grid-cols-2 gap-1">
                {DATE_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => { onDateRangeChange(applyDatePreset(preset)); setShowDatePicker(false) }}
                    className={`text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      activePreset?.label === preset.label
                        ? 'bg-orange-500 text-white'
                        : 'text-foreground hover:bg-surface'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border" />

      {/* Campaign Selector */}
      {campaigns.length > 0 && (
        <div className="relative" ref={campaignRef}>
          <button
            onClick={() => { setShowCampaignPicker(!showCampaignPicker); setShowDatePicker(false) }}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              hasCampaignFilter
                ? 'bg-orange-500 text-white'
                : 'bg-card text-muted border border-border hover:bg-surface'
            }`}
          >
            <span className="max-w-[140px] truncate">
              {hasCampaignFilter
                ? `${selectedCampaigns.size} campanha${selectedCampaigns.size > 1 ? 's' : ''}`
                : 'Todas as campanhas'}
            </span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showCampaignPicker && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-xl shadow-lg z-50 py-2 max-h-80 overflow-y-auto">
              <button
                onClick={() => { onCampaignsChange(null); setShowCampaignPicker(false) }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-surface transition text-left"
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                  !hasCampaignFilter ? 'bg-orange-500 border-orange-500' : 'border-border'
                }`}>
                  {!hasCampaignFilter && <Check className="w-3 h-3 text-white" />}
                </span>
                Todas as campanhas
              </button>
              <div className="border-t border-border my-1" />
              {campaigns.map(c => {
                const isSelected = selectedCampaigns?.has(c.campaign_id) ?? false
                return (
                  <button
                    key={c.campaign_id}
                    onClick={() => {
                      const next = new Set<string>(selectedCampaigns ?? [])
                      if (isSelected) {
                        next.delete(c.campaign_id)
                      } else {
                        next.add(c.campaign_id)
                      }
                      onCampaignsChange(next.size > 0 ? next : null)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-surface transition text-left"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-orange-500 border-orange-500' : 'border-border'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="truncate">{c.name || c.campaign_id}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Clear filters */}
      {(hasCampaignFilter || activePreset === undefined) && (
        <button
          onClick={() => {
            onDateRangeChange(getDefaultDateRange())
            onCampaignsChange(null)
          }}
          className="flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition"
        >
          <X className="w-3 h-3" />
          Limpar
        </button>
      )}
    </div>
  )
}
