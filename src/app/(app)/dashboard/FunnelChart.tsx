'use client'

import { useEffect, useState } from 'react'

type FunnelStage = {
  name: string
  value: number
  color: string
}

type ConversionRate = {
  from: string
  to: string
  rate: number
}

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
        setStages(data.stages || [])
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

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <h3 className="font-bold mb-1 text-slate-900">Funil de Conversão</h3>
      <p className="text-xs text-slate-500 mb-6">Taxas de conversão entre cada etapa</p>

      <div className="space-y-3">
        {stages.map((stage, i) => {
          const width = (stage.value / maxValue) * 100
          const prevStage = i > 0 ? stages[i - 1] : null
          const convRate = prevStage && prevStage.value > 0 ? (stage.value / prevStage.value) * 100 : null

          return (
            <div key={stage.name}>
              {convRate !== null && (
                <div className="flex items-center gap-2 mb-1 pl-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {convRate.toFixed(1)}% conversão
                  </span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-between rounded-lg px-4 py-3 transition-all min-h-[52px]"
                  style={{
                    width: `${Math.max(width, 15)}%`,
                    backgroundColor: `${stage.color}15`,
                    borderLeft: `4px solid ${stage.color}`,
                  }}
                >
                  <span className="text-sm font-bold text-slate-700 whitespace-nowrap">{stage.name}</span>
                  <span className="text-sm font-black ml-2" style={{ color: stage.color }}>
                    {stage.value.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {stages.length > 0 && stages[0].value > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {rates.map((r, i) => (
            <div key={i} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase text-slate-400">{r.from} → {r.to}</p>
              <p className={`text-lg font-black ${r.rate >= 20 ? 'text-emerald-600' : r.rate >= 10 ? 'text-amber-500' : 'text-red-500'}`}>
                {r.rate.toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
