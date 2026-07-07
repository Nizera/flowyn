'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, CreditCard, DollarSign, PackageCheck, Users } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

type Stats = { totalRevenue: number; paidCount: number; pendingCount: number; productCount: number }
type Order = { id: string; amount: number | string; status: string; created_at: string; customer_name?: string; product?: { name?: string } }
type ChartPoint = { name: string; revenue: number }

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ totalRevenue: 0, paidCount: 0, pendingCount: 0, productCount: 0 })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [chartData, setChartData] = useState<ChartPoint[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        const [{ data: orders }, { count: productCount }] = await Promise.all([
          supabase
            .from('orders')
          .select('id, amount, status, created_at, customer_name, product:products!inner(name, owner_id)')
          .eq('product.owner_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user.id),
      ])

      const ordersList = (orders || []) as Order[]
      const paid = ordersList.filter(o => o.status === 'paid')
      const totalRevenue = paid.reduce((acc, o) => acc + Number(o.amount), 0)

      setStats({
        totalRevenue,
        paidCount: paid.length,
        pendingCount: ordersList.filter(o => o.status === 'pending').length,
        productCount: productCount || 0,
      })

      setRecentOrders(ordersList.slice(0, 5))

      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
      const chart: ChartPoint[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
        const dayOrders = paid.filter(o => {
          const created = new Date(o.created_at)
          return created >= dayStart && created < dayEnd
        })
        chart.push({
          name: days[dayStart.getDay()],
          revenue: dayOrders.reduce((acc: number, o: Order) => acc + Number(o.amount), 0),
        })
      }
      setChartData(chart)
      } catch (err) {
        console.error('[Dashboard] loadData error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return <div className="rounded-[10px] bg-white px-8 py-16 text-center text-slate-400">Carregando painel de controle...</div>
  }

  return (
    <section className="overflow-hidden rounded-[10px] bg-white px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Visao geral</h2>
          <p className="mt-2 text-sm text-slate-400">Acompanhe faturamento, produtos e vendas dos seus checkouts.</p>
        </div>
        <Link href="/dashboard/products/new" className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600">
          Criar
        </Link>
      </div>

      <div className="mt-10 border-y border-slate-200">
        <RowTitle title="Resumo" description="Indicadores principais." />
        <div className="grid gap-6 py-6 md:grid-cols-4">
          <Summary label="Faturamento" value={currency(stats.totalRevenue)} icon={<DollarSign className="h-4 w-4" />} />
          <Summary label="Produtos" value={String(stats.productCount)} icon={<PackageCheck className="h-4 w-4" />} />
          <Summary label="Aprovadas" value={String(stats.paidCount)} icon={<Users className="h-4 w-4" />} />
          <Summary label="Pendentes" value={String(stats.pendingCount)} icon={<CreditCard className="h-4 w-4" />} />
        </div>
      </div>

      <div className="border-b border-slate-200">
        <RowTitle title="Desempenho" description="Faturamento dos ultimos 7 dias." />
        <div className="py-6">
          <div className="h-[300px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.22}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dx={-10} tickFormatter={(val) => `R$${val}`} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 12px 30px rgba(15,23,42,0.08)' }} />
                  <Area type="monotone" dataKey="revenue" name="Faturamento (R$)" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem dados suficientes para o grafico</div>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <RowTitle title="Vendas recentes" description="Ultimas transacoes." />
        <div className="py-6">
          {recentOrders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-6 py-12 text-center">
              <p className="text-sm text-slate-400">Nenhuma venda registrada ainda.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {recentOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0">
                  <div>
                    <h4 className="text-base font-semibold text-slate-950">{order.customer_name}</h4>
                    <p className="text-xs text-slate-400">{order.product?.name || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-semibold text-slate-950">{currency(Number(order.amount))}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${order.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {order.status === 'paid' ? 'Aprovado' : 'Pendente'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/dashboard/sales" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-600 transition hover:text-orange-800">
            Ver relatorio completo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function Summary({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function RowTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="pt-6">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  )
}
