'use client'

import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { DollarSign, Megaphone, Users, PackageCheck, CreditCard, TrendingUp, AlertTriangle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { RevenueSpendChart } from './RevenueSpendChart'

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

const PAYMENT_COLORS: Record<string, string> = { paid: '#10b981', pending: '#f59e0b', refunded: '#ef4444', unknown: '#cbd5e1' }
const STATUS_LABELS: Record<string, string> = { paid: 'Pago', pending: 'Pendente', refunded: 'Estornado', unknown: 'Outros' }

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/meta-ads/dashboard')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-10 text-center">Carregando painel...</div>

  const s = data?.summary || { total_revenue: 0, total_spend: 0, roas: 0, net_profit: 0, total_orders: 0, pending_revenue: 0, refunded_revenue: 0, profit_margin: 0, arpu: 0, chargeback_rate: 0 }

  const cards = [
    { label: 'Faturamento Líquido', value: currency(s.total_revenue), icon: DollarSign },
    { label: 'Gastos com Anúncios', value: currency(s.total_spend), icon: Megaphone },
    { label: 'ROAS', value: `${s.roas.toFixed(2)}x`, icon: TrendingUp },
    { label: 'Lucro Líquido', value: currency(s.net_profit), icon: DollarSign },
    { label: 'Vendas Pendentes', value: currency(s.pending_revenue), icon: CreditCard },
    { label: 'Margem de Lucro', value: `${s.profit_margin.toFixed(1)}%`, icon: PackageCheck },
    { label: 'ARPU', value: currency(s.arpu), icon: Users },
    { label: 'Chargeback', value: `${s.chargeback_rate.toFixed(1)}%`, icon: AlertTriangle },
  ]

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard Principal</h1>
        <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm">Atualizar</button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-slate-500">{card.label}</span>
              <card.icon className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-2xl font-black text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm col-span-1">
          <h3 className="font-bold mb-4">Vendas por Pagamento</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data?.payment_breakdown} innerRadius={60} outerRadius={80} dataKey="total">
                {data?.payment_breakdown.map((entry: any, i: number) => (
                  <Cell key={i} fill={PAYMENT_COLORS[entry.status] || PAYMENT_COLORS.unknown} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => currency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="col-span-2">
          <RevenueSpendChart data={data?.spend_over_time || []} period={data?.period || { start_date: '', end_date: '' }} />
        </div>
      </div>
    </div>
  )
}