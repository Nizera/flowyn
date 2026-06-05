import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CheckCircle2, Clock, DollarSign, TrendingUp, XCircle } from 'lucide-react'

export default async function SalesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: myProducts } = await supabase
    .from('products')
    .select('id')
    .eq('owner_id', user.id)

  const productIds = myProducts?.map(p => p.id) || []
  let orders: any[] = []

  if (productIds.length > 0) {
    const { data } = await supabase
      .from('orders')
      .select('*, product:products(name), plan:plans(name)')
      .in('product_id', productIds)
      .order('created_at', { ascending: false })

    orders = data || []
  }

  const paidOrders = orders.filter(o => o.status === 'paid')
  const totalRevenue = paidOrders.reduce((acc, o) => acc + Number(o.amount), 0)
  const paidCount = paidOrders.length
  const pendingCount = orders.filter(o => o.status === 'pending').length
  const averageTicket = paidCount > 0 ? totalRevenue / paidCount : 0

  return (
    <div className="w-full pb-12">
      <main className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Minhas Vendas</h2>
          <p className="mt-1 font-medium text-white/60">Acompanhe todas as transacoes dos seus produtos.</p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <SummaryCard title="Faturamento Total" value={`R$ ${totalRevenue.toFixed(2).replace('.', ',')}`} icon={<DollarSign className="h-4 w-4" />} />
          <SummaryCard title="Ticket Medio" value={`R$ ${averageTicket.toFixed(2).replace('.', ',')}`} icon={<TrendingUp className="h-4 w-4" />} />
          <SummaryCard title="Vendas Aprovadas" value={String(paidCount)} icon={<CheckCircle2 className="h-4 w-4" />} blue />
          <SummaryCard title="Pendentes" value={String(pendingCount)} icon={<Clock className="h-4 w-4" />} amber />
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-xl">
          <div className="border-b border-white/5 px-6 py-5">
            <h3 className="text-lg font-bold text-white">Historico de Transacoes</h3>
          </div>

          {orders.length === 0 ? (
            <div className="py-16 text-center">
              <DollarSign className="mx-auto mb-3 h-12 w-12 text-white/20" />
              <h4 className="mb-1 text-lg font-bold text-white">Nenhuma transacao ainda</h4>
              <p className="text-sm text-white/50">Quando alguem comprar seus produtos, as vendas aparecerao aqui.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-white/5 bg-[#0a0a0a] text-xs uppercase tracking-wider text-white/50">
                  <tr>
                    <th className="whitespace-nowrap px-6 py-4 text-left font-semibold">Cliente</th>
                    <th className="whitespace-nowrap px-6 py-4 text-left font-semibold">Produto / Plano</th>
                    <th className="whitespace-nowrap px-6 py-4 text-right font-semibold">Valor</th>
                    <th className="whitespace-nowrap px-6 py-4 text-center font-semibold">Status</th>
                    <th className="whitespace-nowrap px-6 py-4 text-right font-semibold">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.map(order => (
                    <tr key={order.id} className="transition-colors hover:bg-white/5">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div>
                          <p className="font-semibold text-white">{order.customer_name}</p>
                          <p className="text-xs text-white/50">{order.customer_email}</p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="font-medium text-white">{order.product?.name || '-'}</p>
                        <p className="text-xs text-white/50">{order.plan?.name || '-'}</p>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-bold text-white">
                        R$ {Number(order.amount).toFixed(2).replace('.', ',')}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        {order.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#00e88a]/20 bg-[#00e88a]/10 px-2.5 py-1 text-xs font-bold text-[#00e88a]">
                            <CheckCircle2 className="h-3 w-3" /> Pago
                          </span>
                        ) : order.status === 'refunded' ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-400">
                            <XCircle className="h-3 w-3" /> Reembolsado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-400">
                            <Clock className="h-3 w-3" /> Pendente
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-xs text-white/50">
                        {new Date(order.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function SummaryCard({ title, value, icon, blue, amber }: { title: string; value: string; icon: React.ReactNode; blue?: boolean; amber?: boolean }) {
  const color = blue ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : amber ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-[#00e88a] bg-[#00e88a]/10 border-[#00e88a]/20'
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-xl transition-colors hover:border-[#00e88a]/30">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#00e88a]/5 blur-[40px] transition-colors group-hover:bg-[#00e88a]/10" />
      <div className="relative z-10 mb-3 flex items-start justify-between">
        <p className="text-sm font-semibold uppercase tracking-wider text-white/50">{title}</p>
        <div className={`rounded-xl border p-2 ${color}`}>{icon}</div>
      </div>
      <h3 className="relative z-10 text-2xl font-bold text-white">{value}</h3>
    </div>
  )
}
