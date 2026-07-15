'use client'

import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Calendar } from 'lucide-react'

interface DataPoint {
  date: string
  spend: number
  revenue: number
}

interface Props {
  data: DataPoint[]
  period: { start_date: string; end_date: string }
}

const PERIODS = [
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
  { label: 'Ano', days: 365 },
]

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
      <p className="mb-2 text-xs font-semibold text-slate-500">{formatDate(label)}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600">{entry.dataKey === 'revenue' ? 'Receita' : 'Gasto'}:</span>
          <span className="font-bold text-slate-900">{currency(entry.value)}</span>
        </div>
      ))}
      {payload.length === 2 && (
        <div className="mt-2 border-t border-slate-100 pt-2 text-xs font-bold">
          <span className="text-slate-500">Lucro: </span>
          <span className={payload[0].value - payload[1].value >= 0 ? 'text-emerald-600' : 'text-red-600'}>
            {currency(payload[0].value - payload[1].value)}
          </span>
        </div>
      )}
    </div>
  )
}

export function RevenueSpendChart({ data, period }: Props) {
  const [selectedPeriod, setSelectedPeriod] = useState(30)

  const filteredData = (() => {
    if (!data?.length) return []
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - selectedPeriod)
    cutoff.setHours(0, 0, 0, 0)
    return data.filter(d => new Date(d.date + 'T12:00:00') >= cutoff)
  })()

  const totalRevenue = filteredData.reduce((s, d) => s + (d.revenue || 0), 0)
  const totalSpend = filteredData.reduce((s, d) => s + (d.spend || 0), 0)
  const netProfit = totalRevenue - totalSpend
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-900">Receita vs Gasto</h3>
          <p className="mt-1 text-sm text-slate-400">Comparativo diario ao longo do tempo</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {PERIODS.map(p => (
            <button
              key={p.days}
              onClick={() => setSelectedPeriod(p.days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                selectedPeriod === p.days
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {filteredData.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-4 rounded-xl bg-slate-50 p-4">
          <div>
            <p className="text-xs font-semibold text-slate-500">Receita</p>
            <p className="text-lg font-black text-emerald-600">{currency(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Gasto</p>
            <p className="text-lg font-black text-red-500">{currency(totalSpend)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">ROAS</p>
            <p className={`text-lg font-black ${roas >= 1 ? 'text-emerald-600' : 'text-red-500'}`}>
              {roas.toFixed(2)}x
            </p>
          </div>
        </div>
      )}

      <div className="mt-6" style={{ height: 320 }}>
        {filteredData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Nenhum dado disponivel para este periodo
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
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
              <Legend
                formatter={(value) => value === 'revenue' ? 'Receita' : 'Gasto'}
                iconType="circle"
                iconSize={8}
              />
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
                stroke="#ef4444"
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
