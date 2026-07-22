import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { BookOpen, Box, ExternalLink, FileText, Layers, Plus, Search, Users, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { CopyUtmButton } from '@/components/CopyUtmButton'
import { currency } from '@/lib/format'
import { checkPlanLimit } from '@/lib/subscription'
import { ToggleProductActive } from './ToggleProductActive'

type ProductPlanRow = {
  price: string | number | null
}

type OrderSaleRow = {
  product_id: string
  amount: string | number | null
}

const TYPE_CONFIG: Record<string, { label: string; badge: string; icon: LucideIcon }> = {
  course: { label: 'Curso', badge: 'bg-orange-50 text-orange-600 ring-orange-100', icon: BookOpen },
  ebook: { label: 'E-book', badge: 'bg-violet-50 text-violet-700 ring-violet-100', icon: FileText },
  mentoria: { label: 'Mentoria', badge: 'bg-amber-50 text-amber-700 ring-amber-100', icon: Users },
  outros: { label: 'Infoproduto', badge: 'bg-surface text-foreground ring-border', icon: Layers },
}

function date(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: products } = await supabase
    .from('products')
    .select(`
      id, name, logo_url, cover_url, product_type, category, created_at, is_public, is_active,
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

  const salesByProduct = (sales ?? []).reduce((acc: Record<string, number>, s: OrderSaleRow) => {
    acc[s.product_id] = (acc[s.product_id] || 0) + Number(s.amount || 0)
    return acc
  }, {})

  const productLimit = await checkPlanLimit(user.id, 'products')
  const atLimit = !productLimit.allowed
  const nearLimit = productLimit.plan === 'free' && productLimit.current >= productLimit.max - 1

  return (
    <section className="overflow-hidden rounded-[10px] bg-card px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Produtos</h2>
          <p className="mt-2 text-sm text-muted">Lista de produtos cadastrados no sistema.</p>
        </div>
        <Link href="/dashboard/products/new" className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-7 text-sm font-semibold text-white transition ${atLimit ? 'cursor-not-allowed bg-surface' : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600'}`}>
          <Plus className="h-4 w-4" />
          Criar
        </Link>
      </div>

      {nearLimit && !atLimit && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>
            Voce esta usando <strong>{productLimit.current} de {productLimit.max}</strong> produto(s) do plano gratuito.
            <Link href="/dashboard/settings/subscription" className="ml-1 font-bold underline">Atualize para Pro</Link> para criar mais.
          </p>
        </div>
      )}

      {atLimit && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>
            Voce atingiu o limite de <strong>{productLimit.max}</strong> produto(s) do plano gratuito.
            <Link href="/dashboard/settings/subscription" className="ml-1 font-bold underline">Atualize para Pro</Link> para criar mais.
          </p>
        </div>
      )}

      <div className="mt-12">
        <div className="flex flex-col gap-4 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              className="h-10 w-full rounded-xl border-0 bg-surface pl-11 pr-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted focus:bg-card focus:ring-2 focus:ring-orange-500/20"
              placeholder="Buscar"
              disabled
            />
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-foreground">
            <span className="flex h-8 w-14 items-center rounded-full bg-surface p-1">
              <span className="h-6 w-6 rounded-full bg-card shadow-sm" />
            </span>
            Exibir produtos ocultos
          </label>
        </div>

        {(!products || products.length === 0) ? (
          <div className="rounded-lg border border-border px-5 py-20 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface">
              <Box className="h-7 w-7 text-muted" />
            </div>
            <h3 className="text-lg font-black text-foreground">Nenhum produto criado</h3>
            <p className="mt-2 text-sm text-muted">Crie seu primeiro infoproduto e publique um checkout hoje.</p>
            <Link href="/dashboard/products/new" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-black text-white">
              <Plus className="h-4 w-4" />
              Criar
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-border text-sm font-medium text-foreground">
                <tr>
                  <th className="px-5 py-4">Produto</th>
                  <th className="px-5 py-4">Tipo</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Preco inicial</th>
                  <th className="px-5 py-4">Vendido</th>
                  <th className="px-5 py-4">Cadastro</th>
                  <th className="px-5 py-4 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map(product => {
                  const cfg = TYPE_CONFIG[product.product_type] ?? TYPE_CONFIG.outros
                  const Icon = cfg.icon
                  const minPrice = product.plans?.length
                    ? Math.min(...product.plans.map((p: ProductPlanRow) => Number(p.price || 0)))
                    : null
                  const total = salesByProduct[product.id] ?? 0

                  return (
                    <tr key={product.id} className="transition hover:bg-surface/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {product.logo_url ? (
                            <img src={product.logo_url} alt="" className="h-11 w-11 rounded-xl object-cover ring-1 ring-border" />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface">
                              <Icon className="h-5 w-5 text-muted" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-black text-foreground">{product.name}</p>
                            <p className="mt-0.5 truncate text-xs text-muted">{product.category || 'Sem categoria'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-1 ${cfg.badge}`}>{cfg.label}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-1 ${product.is_public ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-surface text-muted ring-border'}`}>
                            {product.is_public ? 'Publicado' : 'Rascunho'}
                          </span>
                          <ToggleProductActive productId={product.id} isActive={product.is_active ?? true} atLimit={atLimit} />
                        </div>
                      </td>
                      <td className="px-5 py-4 font-bold text-foreground">{minPrice !== null ? currency(minPrice) : '-'}</td>
                      <td className="px-5 py-4 font-bold text-foreground">{currency(total)}</td>
                      <td className="px-5 py-4 text-muted">{date(product.created_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <CopyUtmButton productId={product.id} />
                          <Link href={`/dashboard/products/${product.id}`} className="rounded-lg border border-border px-3 py-2 text-xs font-black text-muted transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600">
                            Editar
                          </Link>
                          <Link href={`/dashboard/products/${product.id}/checkout-editor`} title="Editar checkout" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
