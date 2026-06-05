'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, ArrowRight, CreditCard, DollarSign, PackageCheck, Users } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalRevenue: 0, paidCount: 0, pendingCount: 0, productCount: 0 })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: myProducts } = await supabase
        .from('products')
        .select('id')
        .eq('owner_id', user.id)

      const productIds = myProducts?.map(p => p.id) || []
      let orders: any[] = []

      if (productIds.length > 0) {
        const { data } = await supabase
          .from('orders')
          .select('*, product:products(name)')
          .in('product_id', productIds)
          .order('created_at', { ascending: false })
        orders = data || []
      }

      const paid = orders.filter(o => o.status === 'paid')
      const totalRevenue = paid.reduce((acc, o) => acc + Number(o.amount), 0)

      setStats({
        totalRevenue,
        paidCount: paid.length,
        pendingCount: orders.filter(o => o.status === 'pending').length,
        productCount: productIds.length,
      })

      setRecentOrders(orders.slice(0, 5))

      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
      const chart: any[] = []
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
          revenue: dayOrders.reduce((acc: number, o: any) => acc + Number(o.amount), 0),
        })
      }
      setChartData(chart)
      setLoading(false)
    }
    loadData()
  }, [])

  if (loading) {
    return <div className="p-8 text-center text-white/50 animate-pulse">Carregando painel de controle...</div>
  }

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

  return (
    <div className="w-full pb-12">
      <main className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white">Visao do Produtor</h2>
            <p className="mt-1 font-medium text-white/60">Acompanhe faturamento, produtos e vendas dos seus checkouts.</p>
          </div>
          <Link href="/dashboard/products/new" className="flex items-center gap-2 rounded-lg bg-[#00e88a] px-6 py-2.5 font-semibold text-black shadow-[0_0_15px_rgba(0,232,138,0.3)] transition-all hover:-translate-y-0.5 hover:bg-[#00e88a]/90 hover:shadow-[0_0_25px_rgba(0,232,138,0.5)]">
            Criar Novo Produto
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Kpi title="Faturamento Total" value={fmt(stats.totalRevenue)} icon={<DollarSign className="h-5 w-5" />} hint="Vendas aprovadas" />
          <Kpi title="Produtos Criados" value={String(stats.productCount)} icon={<PackageCheck className="h-5 w-5" />} hint="Checkouts em configuracao" />
          <Kpi title="Vendas Aprovadas" value={String(stats.paidCount)} icon={<Users className="h-5 w-5" />} hint="Transacoes com status pago" blue />
          <Kpi title="Pendentes" value={String(stats.pendingCount)} icon={<CreditCard className="h-5 w-5" />} hint="Aguardando confirmacao" amber />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-xl lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Desempenho Geral</h3>
                <p className="text-sm text-white/50">Faturamento dos ultimos 7 dias</p>
              </div>
            </div>
            <div className="h-[300px] w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00e88a" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00e88a" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} tickFormatter={(val) => `R$${val}`} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: '#111', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' }} itemStyle={{ color: '#fff' }} />
                    <Area type="monotone" dataKey="revenue" name="Faturamento (R$)" stroke="#00e88a" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-white/30">Sem dados suficientes para o grafico</div>
              )}
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Vendas Recentes</h3>
              <Link href="/dashboard/sales" className="rounded-lg p-2 text-[#00e88a] transition-colors hover:bg-white/5">
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                <DollarSign className="mb-3 h-10 w-10 text-white/20" />
                <p className="text-sm text-white/50">Nenhuma venda registrada ainda.</p>
                <p className="mt-1 text-xs text-white/40">As transacoes aparecerao aqui em tempo real.</p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-4">
                {recentOrders.map(order => (
                  <div key={order.id} className="group flex cursor-pointer items-center justify-between rounded-xl border border-transparent p-4 transition-all hover:border-white/10 hover:bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#0a0a0a] font-bold text-[#00e88a]">
                        {order.customer_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white transition-colors group-hover:text-[#00e88a]">{order.customer_name}</h4>
                        <p className="text-xs text-white/50">{order.product?.name || '-'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{fmt(Number(order.amount))}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${order.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {order.status === 'paid' ? 'Aprovado' : 'Pendente'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Link href="/dashboard/sales" className="mt-4 block w-full rounded-xl py-3 text-center text-sm font-semibold text-[#00e88a] transition-colors hover:bg-white/5">
              Ver relatorio completo
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

function Kpi({ title, value, hint, icon, blue, amber }: { title: string; value: string; hint: string; icon: React.ReactNode; blue?: boolean; amber?: boolean }) {
  const color = blue ? 'text-blue-400 border-blue-500/20 bg-blue-500/10' : amber ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' : 'text-[#00e88a] border-[#00e88a]/20 bg-[#00e88a]/10'
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-xl transition-all hover:border-[#00e88a]/30">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#00e88a]/5 blur-[40px] transition-colors group-hover:bg-[#00e88a]/10" />
      <div className="relative z-10 mb-4 flex items-start justify-between">
        <div>
          <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-white/50">{title}</p>
          <h3 className="text-2xl font-bold text-white">{value}</h3>
        </div>
        <div className={`rounded-xl border p-3 ${color}`}>{icon}</div>
      </div>
      <div className="relative z-10 flex items-center text-sm">
        <span className="text-white/40">{hint}</span>
      </div>
    </div>
  )
}
