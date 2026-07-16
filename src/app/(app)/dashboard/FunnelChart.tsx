'use client'

import { useEffect, useState } from 'react'
import { MousePointerClick, Eye, ShoppingCart, CreditCard, CheckCircle } from 'lucide-react'

type FunnelStage = {
  name: string
  value: number
  color: string
  description: string
  icon: React.ReactNode
}

type ConversionRate = {
  from: string
  to: string
  rate: number
}

const STAGE_META = [
  { color: '#3b82f6', description: 'Usuários clicaram no anúncio', Icon: MousePointerClick },
  { color: '#8b5cf6', description: 'Usuários visitaram a página', Icon: Eye },
  { color: '#ec4899', description: 'Usuários iniciaram o checkout', Icon: ShoppingCart },
  { color: '#f97316', description: 'Compras iniciadas', Icon: CreditCard },
  { color: '#10b981', description: 'Compras aprovadas', Icon: CheckCircle },
]

export function FunnelChart({ adAccountId }: { adAccountId?: string }) {
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [rates, setRates] = useState<ConversionRate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (adAccountId) params.set('ad_account_id', adAccountId)
    fetch(`/api/meta-ads/funnel?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        const enriched = (data.stages || []).map((s: any, i: number) => {
          const meta = STAGE_META[i]
          const IconComp = meta?.Icon
          return {
            ...s,
            color: meta?.color || '#64748b',
            description: meta?.description || '',
            icon: IconComp ? <IconComp className="h-4 w-4" /> : null,
          }
        })
        setStages(enriched)
        setRates(data.conversion_rates || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [adAccountId])

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold mb-4 text-slate-900">Funil de Conversão</h3>
        <div className="py-8 text-center text-sm text-slate-400">Carregando...</div>
      </div>
    )
  }

  const maxValue = Math.max(...stages.map(s => s.value), 1)

  // Calculate cumulative conversion (from first stage)
  const firstValue = stages[0]?.value || 1
  const cumulativeRates = stages.map(s => (s.value / firstValue) * 100)

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-black text-slate-900 text-lg">Funil de Conversão</h3>
          <p className="text-xs text-slate-500">Taxas de conversão entre cada etapa</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 focus:border-blue-500 focus:outline-none">
            <option>Funil padrão</option>
          </select>
          <button className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[180px_1fr_100px_100px] gap-4 border-b border-slate-100 px-4 pb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Etapa</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quantidade</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Conversão</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Conversão Acumulada</span>
      </div>

      {/* Stages */}
      <div className="divide-y divide-slate-50">
        {stages.map((stage, i) => {
          const width = (stage.value / maxValue) * 100
          const convRate = i > 0 && stages[i - 1].value > 0
            ? ((stage.value / stages[i - 1].value) * 100)
            : 100
          const dropRate = i > 0 ? convRate - 100 : 0
          const cumulative = cumulativeRates[i]

          return (
            <div key={stage.name} className="grid grid-cols-[180px_1fr_100px_100px] gap-4 items-center px-4 py-4 hover:bg-slate-50/50 transition-colors">
              {/* Stage info */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${stage.color}15`, color: stage.color }}
                >
                  {stage.icon}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400">0{i + 1}</span>
                    <span className="text-sm font-black text-slate-900">{stage.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{stage.description}</p>
                </div>
              </div>

              {/* Bar + Value */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-8 rounded-lg bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-500"
                    style={{
                      width: `${Math.max(width, 3)}%`,
                      backgroundColor: stage.color,
                    }}
                  />
                </div>
                <span className="text-sm font-black text-slate-900 w-10 text-right">
                  {stage.value}
                </span>
              </div>

              {/* Conversion rate */}
              <div className="text-right">
                <p className="text-sm font-black text-slate-900">
                  {convRate.toFixed(1).replace('.', ',')}%
                </p>
                {i > 0 && (
                  <p className={`text-[10px] font-bold ${dropRate >= -30 ? 'text-emerald-500' : 'text-red-400'}`}>
                    {dropRate.toFixed(1).replace('.', ',')}%
                  </p>
                )}
              </div>

              {/* Cumulative */}
              <div className="text-right">
                <p className="text-sm font-black text-slate-900">
                  {cumulative.toFixed(1).replace('.', ',')}%
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom conversion cards */}
      {rates.length > 0 && (
        <div className="mt-6 grid grid-cols-5 gap-3">
          {rates.map((r, i) => {
            const isOverall = i === rates.length - 1
            return (
              <div key={i} className={`rounded-xl px-3 py-3 ${isOverall ? 'bg-blue-50 ring-1 ring-blue-100' : 'bg-slate-50'}`}>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {r.from} → {r.to}
                </p>
                <p className={`text-xl font-black ${isOverall ? 'text-blue-600' : 'text-slate-900'}`}>
                  {r.rate.toFixed(1).replace('.', ',')}%
                </p>
                <p className="text-[10px] text-slate-400">
                  {isOverall ? 'Conversão geral' : 'Taxa de conversão'}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
