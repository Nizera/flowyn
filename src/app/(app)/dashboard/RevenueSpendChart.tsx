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
}

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'Ano', days: 365 },
]

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string | number }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
      <p className="mb-2 text-xs font-semibold text-slate-500">{formatDate(label as string)}</p>
      {payload.map((entry: TooltipEntry) => (
        <div key={entry.dataKey as string} className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600">{entry.dataKey === 'revenue' ? 'Receita' : 'Gasto'}:</span>
          <span className="font-bold text-slate-900">{currency(entry.value as number)}</span>
        </div>
      ))}
      {payload.length === 2 && (
        <div className="mt-2 border-t border-slate-100 pt-2 text-xs font-bold">
          <span className="text-slate-500">Lucro: </span>
          <span className={(payload[0].value as number) - (payload[1].value as number) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
            {currency((payload[0].value as number) - (payload[1].value as number))}
          </span>
        </div>
      )}
    </div>
  )
}

export function RevenueSpendChart({ data }: Props) {
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
    <div>
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <h4 className="text-lg font-bold text-slate-900">Receita vs Investimento</h4>
        <div className="flex bg-slate-100 rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p.days}
              onClick={() => setSelectedPeriod(p.days)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                selectedPeriod === p.days
                  ? 'bg-white shadow-sm text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-8 mb-6">
        <div>
          <p className="text-xs font-bold text-slate-500">Receita Total</p>
          <p className="text-xl font-black text-emerald-600">{currency(totalRevenue)}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500">Gasto Total</p>
          <p className="text-xl font-black text-rose-600">{currency(totalSpend)}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500">ROAS Médio</p>
          <p className="text-xl font-black text-slate-900">{roas.toFixed(1)}x</p>
        </div>
      </div>

      <div className="h-64">
        {filteredData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Nenhum dado disponível para este período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e11d48" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `R$${v}`}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#colorRevenue)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="spend"
                stroke="#e11d48"
                strokeWidth={2}
                fill="url(#colorSpend)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}