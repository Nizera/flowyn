'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { DollarSign, Megaphone, Users, PackageCheck, CreditCard, TrendingUp, AlertTriangle, GripVertical } from 'lucide-react'
import { DashboardProvider, useDashboard } from '@/contexts/DashboardContext'
import { DashboardContextMenu } from '@/components/DashboardContextMenu'
import { RevenueSpendChart } from './RevenueSpendChart'
import { FunnelChart } from './FunnelChart'

const DashboardGrid = dynamic(() => import('./DashboardGrid').then(m => ({ default: m.DashboardGrid })), { ssr: false })

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

const PAYMENT_COLORS: Record<string, string> = { paid: '#10b981', pending: '#f59e0b', refunded: '#ef4444', unknown: '#cbd5e1' }

function DashboardInner() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { editMode, setContextMenu } = useDashboard()

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setContextMenu({ x: detail.x, y: detail.y })
    }
    window.addEventListener('dashboard-contextmenu', handler)
    return () => window.removeEventListener('dashboard-contextmenu', handler)
  }, [setContextMenu])

  useEffect(() => {
    fetch('/api/meta-ads/dashboard')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-10 text-center">Carregando painel...</div>

  const s = data?.summary || { total_revenue: 0, total_spend: 0, roas: 0, net_profit: 0, total_orders: 0, pending_revenue: 0, refunded_revenue: 0, profit_margin: 0, arpu: 0, chargeback_rate: 0 }

  const kpiCards = [
    { id: 'revenue', label: 'Faturamento Líquido', value: currency(s.total_revenue), icon: DollarSign },
    { id: 'spend', label: 'Gastos com Anúncios', value: currency(s.total_spend), icon: Megaphone },
    { id: 'roas', label: 'ROAS', value: `${s.roas.toFixed(2)}x`, icon: TrendingUp },
    { id: 'profit', label: 'Lucro Líquido', value: currency(s.net_profit), icon: DollarSign },
    { id: 'pending', label: 'Vendas Pendentes', value: currency(s.pending_revenue), icon: CreditCard },
    { id: 'margin', label: 'Margem de Lucro', value: `${s.profit_margin.toFixed(1)}%`, icon: PackageCheck },
    { id: 'arpu', label: 'ARPU', value: currency(s.arpu), icon: Users },
    { id: 'chargeback', label: 'Chargeback', value: `${s.chargeback_rate.toFixed(1)}%`, icon: AlertTriangle },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {editMode && (
            <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 ring-1 ring-blue-100">
              <GripVertical className="h-3.5 w-3.5" />
              Modo Edição — arraste os widgets
            </div>
          )}
        </div>
      </div>

      <DashboardGrid data={data} kpiCards={kpiCards}>
        {(widgetId) => {
          // KPI cards
          const kpi = kpiCards.find(c => c.id === widgetId)
          if (kpi) {
            const Icon = kpi.icon
            return (
              <div className="h-full bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-500">{kpi.label}</span>
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
                <p className="text-xl font-black text-slate-900">{kpi.value}</p>
              </div>
            )
          }

          // Charts
          if (widgetId === 'payment_pie') {
            return (
              <div className="h-full bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold mb-3 text-sm text-slate-900">Vendas por Pagamento</h3>
                <ResponsiveContainer width="100%" height="85%">
                  <PieChart>
                    <Pie data={data?.payment_breakdown} innerRadius="55%" outerRadius="75%" dataKey="total">
                      {data?.payment_breakdown.map((entry: any, i: number) => (
                        <Cell key={i} fill={PAYMENT_COLORS[entry.status] || PAYMENT_COLORS.unknown} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )
          }

          if (widgetId === 'revenue_chart') {
            return (
              <div className="h-full bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <RevenueSpendChart data={data?.spend_over_time || []} period={data?.period || { start_date: '', end_date: '' }} />
              </div>
            )
          }

          if (widgetId === 'funnel') {
            return (
              <div className="h-full">
                <FunnelChart />
              </div>
            )
          }

          return <div className="h-full bg-white rounded-2xl border border-slate-200" />
        }}
      </DashboardGrid>

      <DashboardContextMenu />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <DashboardProvider>
      <DashboardInner />
    </DashboardProvider>
  )
}
