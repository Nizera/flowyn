import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Building2, CreditCard, Palette, ShoppingBag, Users } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { OrderBumpManager } from './OrderBumpManager'
import { createOrderBump, updateOrderBump, deleteOrderBump } from './actions'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function OrderBumpsPage({ params }: Props) {
  const { id: productId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: product } = await supabase
    .from('products')
    .select('id, name')
    .eq('id', productId)
    .eq('owner_id', user.id)
    .single()

  if (!product) redirect('/dashboard/products')

  const { data: bumps } = await supabase
    .from('product_order_bumps')
    .select('id, product_id, title, description, image_url, price, original_price, file_paths, plan_ids, sort_order, created_at')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, price, billing_type')
    .eq('product_id', productId)
    .order('price', { ascending: true })

  return (
    <section className="overflow-hidden rounded-[10px] bg-white px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <ProductTabs productId={productId} active="order-bumps" />

      <OrderBumpManager
        bumps={bumps ?? []}
        plans={plans ?? []}
        productId={productId}
        userId={user.id}
        createOrderBump={createOrderBump}
        updateOrderBump={updateOrderBump}
        deleteOrderBump={deleteOrderBump}
      />
    </section>
  )
}

function ProductTabs({ productId, active }: { productId: string; active: string }) {
  const tabs = [
    { href: `/dashboard/products/${productId}`, label: 'Detalhes', icon: Building2, key: 'details' },
    { href: `/dashboard/products/${productId}/plans`, label: 'Planos', icon: CreditCard, key: 'plans' },
    { href: `/dashboard/products/${productId}/content`, label: 'Conteudo', icon: BookOpen, key: 'content' },
    { href: `/dashboard/products/${productId}/journey`, label: 'Mentoria', icon: Users, key: 'journey' },
    { href: `/dashboard/products/${productId}/checkout-editor`, label: 'Checkout', icon: Palette, key: 'checkout' },
    { href: `/dashboard/products/${productId}/order-bumps`, label: 'Order Bumps', icon: ShoppingBag, key: 'order-bumps' },
  ]
  return (
    <div className="mt-8 flex gap-2 overflow-x-auto border-b border-slate-200">
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = tab.key === active
        return (
          <Link key={tab.key} href={tab.href} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${isActive ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
