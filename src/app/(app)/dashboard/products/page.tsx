import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarChart2, BookOpen, Box, FileText, Layers, PlusCircle, Users } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  course: { label: 'Curso', color: 'text-blue-400 bg-blue-400/10', icon: BookOpen },
  ebook: { label: 'E-book', color: 'text-purple-400 bg-purple-400/10', icon: FileText },
  mentoria: { label: 'Mentoria', color: 'text-orange-400 bg-orange-400/10', icon: Users },
  outros: { label: 'Infoproduto', color: 'text-pink-400 bg-pink-400/10', icon: Layers },
}

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: products } = await supabase
    .from('products')
    .select(`
      id, name, logo_url, cover_url, product_type, category, created_at,
      plans(id, price)
    `)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const productIds = (products ?? []).map(p => p.id)
  const { data: sales } = productIds.length > 0
    ? await supabase
        .from('orders')
        .select('product_id, amount')
        .eq('status', 'paid')
        .in('product_id', productIds)
    : { data: [] }

  const salesByProduct = (sales ?? []).reduce((acc: Record<string, number>, s) => {
    acc[s.product_id] = (acc[s.product_id] || 0) + Number(s.amount || 0)
    return acc
  }, {})

  return (
    <div className="py-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Meus Produtos</h1>
          <p className="mt-1 text-sm text-white/50">{products?.length ?? 0} produto(s) criado(s)</p>
        </div>
        <Link href="/dashboard/products/new" className="flex items-center gap-2 rounded-xl bg-[#00e88a] px-5 py-2.5 text-sm font-bold text-black shadow-[0_0_15px_rgba(0,232,138,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(0,232,138,0.4)]">
          <PlusCircle className="h-4 w-4" />
          Criar Produto
        </Link>
      </div>

      {(!products || products.length === 0) && (
        <div className="rounded-3xl border border-white/10 bg-[#111111] py-24 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
            <Box className="h-8 w-8 text-white/20" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-white">Nenhum produto criado</h3>
          <p className="mb-8 text-sm text-white/50">Crie seu primeiro produto e publique um checkout hoje mesmo.</p>
          <Link href="/dashboard/products/new" className="inline-flex items-center gap-2 rounded-xl bg-[#00e88a] px-6 py-3 text-sm font-bold text-black">
            <PlusCircle className="h-4 w-4" /> Criar Primeiro Produto
          </Link>
        </div>
      )}

      {products && products.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {products.map(product => {
            const cfg = TYPE_CONFIG[product.product_type] ?? TYPE_CONFIG.outros
            const Icon = cfg.icon
            const minPrice = product.plans?.length
              ? Math.min(...product.plans.map((p: any) => p.price))
              : null
            const totalRevenue = salesByProduct[product.id] ?? 0

            return (
              <Link key={product.id} href={`/dashboard/products/${product.id}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#111111] transition-all hover:-translate-y-1 hover:border-white/20">
                <div className="relative h-36 overflow-hidden bg-gradient-to-br from-white/5 to-white/0">
                  {product.cover_url ? (
                    <img src={product.cover_url} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Icon className="h-12 w-12 text-white/10" />
                    </div>
                  )}
                  <div className={`absolute left-3 top-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${cfg.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-4 flex items-start gap-3">
                    {product.logo_url ? (
                      <img src={product.logo_url} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/5">
                        <Icon className="h-5 w-5 text-white/30" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-white">{product.name}</h3>
                      <p className="mt-0.5 text-xs text-white/40">{product.category || 'Sem categoria'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
                    <div className="text-center">
                      <p className="mb-0.5 text-xs text-white/40">A partir de</p>
                      <p className="text-sm font-bold text-white">
                        {minPrice !== null ? `R$ ${minPrice.toFixed(2).replace('.', ',')}` : '-'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="mb-0.5 text-xs text-white/40">Vendido</p>
                      <p className="text-sm font-bold text-white">R$ {totalRevenue.toFixed(2).replace('.', ',')}</p>
                    </div>
                  </div>

                  {totalRevenue > 0 && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#00e88a]/5 px-3 py-2">
                      <BarChart2 className="h-3.5 w-3.5 text-[#00e88a]" />
                      <span className="text-xs font-semibold text-[#00e88a]">Produto com vendas aprovadas</span>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
