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
  const stageWidths = stages.map(s => Math.max((s.value / maxValue) * 100, 6))

  const svgW = 520
  const stageH = 56
  const gap = 6
  const svgH = stages.length * (stageH + gap)

  // Build all horizontal Y positions and X boundaries
  const rows = stages.map((stage, i) => {
    const topW = i === 0 ? 100 : stageWidths[i - 1]
    const botW = stageWidths[i]
    const y1 = i * (stageH + gap)
    const y2 = y1 + stageH
    return { topW, botW, y1, y2 }
  })

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <h3 className="font-bold mb-1 text-slate-900">Funil de Conversão</h3>
      <p className="text-xs text-slate-500 mb-6">Taxas de conversão entre cada etapa</p>

      <div className="flex justify-center overflow-hidden">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ maxWidth: '520px' }}>
          <defs>
            {stages.map((stage, i) => (
              <linearGradient key={i} id={`fg${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stage.color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={stage.color} stopOpacity={1} />
              </linearGradient>
            ))}
          </defs>

          {stages.map((stage, i) => {
            const r = rows[i]
            const tl = ((100 - r.topW) / 200) * svgW
            const tr = ((100 + r.topW) / 200) * svgW
            const bl = ((100 - r.botW) / 200) * svgW
            const br = ((100 + r.botW) / 200) * svgW

            const path = `M ${tl} ${r.y1} L ${tr} ${r.y1} L ${br} ${r.y2} L ${bl} ${r.y2} Z`
            const cx = svgW / 2
            const cy = (r.y1 + r.y2) / 2

            const convRate = i > 0 && stages[i - 1].value > 0
              ? ((stage.value / stages[i - 1].value) * 100).toFixed(1)
              : null

            return (
              <g key={stage.name}>
                {/* Funnel segment */}
                <path d={path} fill={`url(#fg${i})`} className="transition-all" />

                {/* Percentage label - top right inside the funnel */}
                <text
                  x={tr - 14}
                  y={cy + 1}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="white"
                  style={{ fontSize: '11px', fontWeight: 900, opacity: 0.9 }}
                >
                  {convRate !== null ? `${convRate}%` : '100%'}
                </text>

                {/* Stage name - left side inside funnel */}
                <text
                  x={tl + 16}
                  y={cy + 1}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fill="white"
                  style={{ fontSize: '12px', fontWeight: 900 }}
                >
                  {stage.name}
                </text>

                {/* Value - center-right */}
                <text
                  x={cx + 20}
                  y={cy + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  style={{ fontSize: '13px', fontWeight: 900, opacity: 0.95 }}
                >
                  {stage.value.toLocaleString('pt-BR')}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Conversion rates grid */}
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
