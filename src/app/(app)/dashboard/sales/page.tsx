import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

type SalesOrderRow = {
  id: string
  amount: string | number | null
  status: string
  customer_name: string | null
  customer_email: string | null
  product: { name?: string } | null
  plan: { name?: string } | null
  created_at: string
}

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

export default async function SalesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProducts } = await supabase
    .from('products')
    .select('id')
    .eq('owner_id', user.id)

  const productIds = myProducts?.map(p => p.id) || []
  let orders: SalesOrderRow[] = []

  if (productIds.length > 0) {
    const { data } = await supabase
      .from('orders')
      .select('id, amount, status, customer_name, customer_email, created_at, product:products(name), plan:plans(name)')
      .in('product_id', productIds)
      .order('created_at', { ascending: false })

    orders = (data || []) as SalesOrderRow[]
  }

  const paidOrders = orders.filter(o => o.status === 'paid')
  const totalRevenue = paidOrders.reduce((acc, o) => acc + Number(o.amount), 0)
  const paidCount = paidOrders.length
  const pendingCount = orders.filter(o => o.status === 'pending').length
  const averageTicket = paidCount > 0 ? totalRevenue / paidCount : 0

  return (
    <section className="overflow-hidden rounded-[10px] bg-white px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Minhas vendas</h2>
          <p className="mt-2 text-sm text-slate-400">Acompanhe transacoes, status e valores recebidos.</p>
        </div>
      </div>

      <div className="mt-10 border-y border-slate-200">
        <RowTitle title="Resumo" description="Indicadores principais." />
        <div className="grid gap-6 py-6 md:grid-cols-4">
          <Summary label="Faturamento" value={currency(totalRevenue)} />
          <Summary label="Ticket medio" value={currency(averageTicket)} />
          <Summary label="Aprovadas" value={String(paidCount)} />
          <Summary label="Pendentes" value={String(pendingCount)} />
        </div>
      </div>

      <div className="border-b border-slate-200">
        <RowTitle title="Transacoes" description="Historico de pedidos." />
        <div className="py-6">
          {orders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-6 py-12 text-center">
              <h3 className="font-semibold text-slate-950">Nenhuma transacao ainda</h3>
              <p className="mt-1 text-sm text-slate-400">Quando alguem comprar seus produtos, as vendas aparecerao aqui.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="border-b border-slate-200 text-sm font-medium text-slate-700">
                  <tr>
                    <th className="px-5 py-4">Cliente</th>
                    <th className="px-5 py-4">Produto / Plano</th>
                    <th className="px-5 py-4 text-right">Valor</th>
                    <th className="px-5 py-4 text-center">Status</th>
                    <th className="px-5 py-4 text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map(order => (
                    <tr key={order.id} className="transition hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="font-semibold text-slate-950">{order.customer_name}</p>
                        <p className="text-xs text-slate-400">{order.customer_email}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="font-medium text-slate-900">{order.product?.name || '-'}</p>
                        <p className="text-xs text-slate-400">{order.plan?.name || '-'}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-slate-950">{currency(Number(order.amount))}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-center">
                        <Status status={order.status} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-xs text-slate-400">
                        {new Date(order.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function Status({ status }: { status: string }) {
  if (status === 'paid') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Pago</span>
  }
  if (status === 'refunded') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700"><XCircle className="h-3 w-3" /> Reembolsado</span>
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700"><Clock className="h-3 w-3" /> Pendente</span>
}

function RowTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="pt-6">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  )
}
