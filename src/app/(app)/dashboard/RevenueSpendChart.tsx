'use client'

import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface TooltipEntry {
  dataKey: string
  color: string
  value: number
}

interface DataPoint {
  date: string
  spend: number
  revenue: number
}

interface Props {
  data: DataPoint[]
  compact?: boolean
}

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'Ano', days: 365 },
]

import { currency } from '@/lib/format'

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string | number }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-lg backdrop-blur-md">
      <p className="mb-2 text-xs font-semibold text-muted">{formatDate(label as string)}</p>
      {payload.map((entry: TooltipEntry) => (
        <div key={entry.dataKey as string} className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted">{entry.dataKey === 'revenue' ? 'Receita' : 'Gasto'}:</span>
          <span className="font-bold text-foreground">{currency(entry.value as number)}</span>
        </div>
      ))}
      {payload.length === 2 && (
        <div className="mt-2 border-t border-border/60 pt-2 text-xs font-bold">
          {(() => {
            const rev = (payload.find(p => p.dataKey === 'revenue')?.value as number) || 0
            const spd = (payload.find(p => p.dataKey === 'spend')?.value as number) || 0
            const profit = rev - spd
            return (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted font-semibold">Lucro:</span>
                <span className={profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {currency(profit)}
                </span>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export function RevenueSpendChart({ data, compact }: Props) {
  const [selectedPeriod, setSelectedPeriod] = useState(30)

  const filteredData = useMemo(() => {
    if (!data?.length) return []
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - selectedPeriod)
    cutoff.setHours(0, 0, 0, 0)
    return data.filter(d => new Date(d.date + 'T12:00:00') >= cutoff)
  }, [data, selectedPeriod])

  const { totalRevenue, totalSpend, roas } = useMemo(() => {
    const rev = filteredData.reduce((s, d) => s + (d.revenue || 0), 0)
    const spd = filteredData.reduce((s, d) => s + (d.spend || 0), 0)
    return { totalRevenue: rev, totalSpend: spd, roas: spd > 0 ? rev / spd : 0 }
  }, [filteredData])

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
        <div>
          <h4 className={`${compact ? 'text-sm' : 'text-base'} font-bold text-foreground`}>Receita vs Investimento</h4>
          {!compact && <p className="text-[11px] text-muted mt-0.5">Visão comparativa de fluxo de caixa e investimento em tráfego.</p>}
        </div>
        <div className="flex bg-surface rounded-lg p-1 border border-border/50">
          {(compact ? PERIODS.slice(0, 3) : PERIODS).map(p => (
            <button
              key={p.days}
              onClick={() => setSelectedPeriod(p.days)}
              className={`px-2 ${compact ? 'px-1.5 text-[10px]' : 'px-3 text-xs'} py-1 rounded-md font-bold transition-all ${
                selectedPeriod === p.days
                  ? 'bg-card shadow-sm text-foreground border border-border/20'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-3 gap-2 sm:gap-6 mb-6 p-3 bg-surface/40 rounded-xl border border-border/40">
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Receita Total</p>
            <p className="text-sm sm:text-lg font-black text-primary mt-0.5">{currency(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Investimento Ads</p>
            <p className="text-sm sm:text-lg font-black text-foreground mt-0.5">{currency(totalSpend)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">ROAS Médio</p>
            <p className="text-sm sm:text-lg font-black text-emerald-600 mt-0.5">{roas.toFixed(1)}x</p>
          </div>
        </div>
      )}

      {compact && (
        <div className="flex items-center gap-4 mb-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f97316]" />
            <span className="font-semibold text-muted">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#475569]" />
            <span className="font-semibold text-muted">Ad Spend</span>
          </div>
        </div>
      )}

      <div className={`${compact ? 'h-44' : 'h-64 sm:h-72'} w-full`}>
        {filteredData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Nenhum dado disponível para este período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.16} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#475569" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#475569" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tickFormatter={v => `R$${v}`}
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                dx={-6}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#f97316"
                strokeWidth={2.5}
                fill="url(#colorRevenue)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, fill: '#f97316' }}
              />
              <Area
                type="monotone"
                dataKey="spend"
                stroke="#475569"
                strokeWidth={2}
                fill="url(#colorSpend)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: '#475569' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}