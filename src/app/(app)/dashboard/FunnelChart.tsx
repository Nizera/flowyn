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

export function FunnelChart({ adAccountId }: { adAccountId?: string }) {
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (adAccountId) params.set('ad_account_id', adAccountId)
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
  }, [adAccountId])

  if (loading) {
    return (
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
        <h3 className="font-bold mb-4 text-foreground">Funil de Conversão</h3>
        <div className="py-8 text-center text-sm text-muted">Carregando...</div>
      </div>
    )
  }

  if (error || stages.length === 0) {
    return (
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
        <h3 className="font-bold mb-4 text-foreground">Funil de Conversão</h3>
        <div className="py-8 text-center text-sm text-muted">
          {error || 'Nenhum dado de funil disponível'}
        </div>
      </div>
    )
  }

  const maxValue = Math.max(...stages.map(s => s.value), 1)

  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
      <h4 className="text-lg font-bold text-foreground mb-6">Funil de Conversão</h4>
      <div className="flex flex-col gap-3">
        {stages.map((stage, i) => {
          const width = (stage.value / maxValue) * 100
          const convRate = i > 0 && stages[i - 1].value > 0
            ? ((stage.value / stages[i - 1].value) * 100)
            : 100

          return (
            <div key={stage.name} className="relative">
              <div className="flex items-center">
                <div className="w-full bg-surface rounded-lg h-12 overflow-hidden relative flex items-center px-4 justify-between group hover:bg-surface transition-colors">
                  <div
                    className="absolute left-0 top-0 bottom-0 rounded-lg transition-all duration-500"
                    style={{
                      width: `${Math.max(width, 3)}%`,
                      backgroundColor: `${stage.color}20`,
                    }}
                  />
                  <span className="text-sm font-medium relative z-10 text-foreground">{stage.name}</span>
                  <span className="text-base font-bold relative z-10 text-foreground">{stage.value.toLocaleString('pt-BR')}</span>
                </div>
              </div>
              {i < stages.length - 1 && (
                <div className="flex justify-center -my-1.5 relative z-20">
                  <div className="bg-card border border-border rounded-full px-2 py-0.5 text-[10px] font-bold text-muted shadow-sm">
                    {convRate.toFixed(1).replace('.', ',')}%
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