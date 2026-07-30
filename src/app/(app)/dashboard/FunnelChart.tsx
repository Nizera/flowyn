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

const STAGE_META = [
  { color: '#3b82f6', description: 'Usuários clicaram no anúncio', Icon: MousePointerClick },
  { color: '#8b5cf6', description: 'Usuários visitaram a página', Icon: Eye },
  { color: '#ec4899', description: 'Usuários iniciaram o checkout', Icon: ShoppingCart },
  { color: '#f97316', description: 'Compras iniciadas', Icon: CreditCard },
  { color: '#10b981', description: 'Compras aprovadas', Icon: CheckCircle },
]

export function FunnelChart({ adAccountId, dateRange, selectedCampaigns }: { adAccountId?: string; dateRange?: { from: string; to: string }; selectedCampaigns?: Set<string> | null }) {
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (adAccountId) params.set('ad_account_id', adAccountId)
    if (dateRange) {
      params.set('start_date', dateRange.from)
      params.set('end_date', dateRange.to)
    }
    if (selectedCampaigns && selectedCampaigns.size > 0) {
      params.set('campaign_ids', Array.from(selectedCampaigns).join(','))
    }
    fetch(`/api/meta-ads/funnel?${params.toString()}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: { stages?: Array<{ name: string; value: number }> }) => {
        const enriched = (data.stages || []).map((s, i: number) => {
          const meta = STAGE_META[i]
          const IconComp = meta?.Icon
          return {
            name: s.name,
            value: s.value,
            color: meta?.color || '#64748b',
            description: meta?.description || '',
            icon: IconComp ? <IconComp className="h-4 w-4" /> : null,
          }
        })
        setStages(enriched)
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setError('Falha ao carregar funil')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [adAccountId, dateRange, selectedCampaigns])

  if (loading) {
    return (
      <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
        <h3 className="font-bold mb-4 text-sm text-foreground">Funil de Conversão</h3>
        <div className="py-8 text-center text-sm text-muted">Carregando...</div>
      </div>
    )
  }

  if (error || stages.length === 0) {
    return (
      <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
        <h3 className="font-bold mb-4 text-sm text-foreground">Funil de Conversão</h3>
        <div className="py-8 text-center text-sm text-muted">
          {error || 'Nenhum dado de funil disponível'}
        </div>
      </div>
    )
  }

  const hasData = stages.some(s => s.value > 0)
  const topValue = stages[0]?.value > 0 ? stages[0].value : Math.max(...stages.map(s => s.value), 1)

  return (
    <div className="bg-card p-5 rounded-2xl border border-border shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-foreground">Funil de Conversão</h4>
        <span className="text-[10px] font-semibold text-muted bg-surface px-2 py-0.5 rounded-full border border-border/50">
          Visão Geral
        </span>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        {stages.map((stage, i) => {
          let width = 0
          if (hasData) {
            const pct = (stage.value / topValue) * 100
            width = stage.value > 0 ? Math.max(pct, 8) : 4
          }

          const prevVal = i > 0 ? stages[i - 1].value : 0
          const convRate = i > 0 && prevVal > 0
            ? ((stage.value / prevVal) * 100)
            : 0

          return (
            <div key={stage.name} className="relative">
              <div className="w-full bg-surface/40 rounded-xl h-11 overflow-hidden relative flex items-center px-3 justify-between border border-border/40 group hover:border-border transition-all">
                <div
                  className="absolute top-0 bottom-0 left-0 rounded-lg transition-all duration-500 ease-out"
                  style={{
                    width: `${width}%`,
                    backgroundColor: hasData ? `${stage.color}20` : 'rgba(148, 163, 184, 0.08)',
                    borderRight: hasData ? `3px solid ${stage.color}` : '2px solid rgba(148, 163, 184, 0.2)',
                  }}
                />

                <div className="flex items-center gap-2 relative z-10 text-foreground">
                  <div
                    className="p-1 rounded-md flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{
                      backgroundColor: `${stage.color}18`,
                      color: stage.color,
                    }}
                  >
                    {stage.icon}
                  </div>
                  <span className="text-[11px] font-bold text-foreground">{stage.name}</span>
                </div>

                <span className="text-xs font-black relative z-10 text-foreground font-mono">
                  {stage.value.toLocaleString('pt-BR')}
                </span>
              </div>

              {i < stages.length - 1 && (
                <div className="flex justify-center -my-1 relative z-20">
                  <div className="bg-card border border-border rounded-full px-2 py-0.5 text-[9px] font-bold text-muted shadow-xs">
                    {hasData && stages[i].value > 0 ? `${convRate.toFixed(1).replace('.', ',')}%` : '0,0%'}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
