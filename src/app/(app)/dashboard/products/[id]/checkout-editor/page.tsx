import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Building2, CreditCard, Palette, ShoppingBag, Users } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { defaultCheckoutConfig, normalizeCheckoutConfig } from '@/lib/checkout-customization'
import { CheckoutEditorClient } from './CheckoutEditorClient'

export const dynamic = 'force-dynamic'

export default async function CheckoutEditorPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: product } = await supabase.from('products').select('id, name, description, image_url, price, currency, is_public, is_published, checkout_mode, created_at, owner_id').eq('id', id).eq('owner_id', user.id).single()
  if (!product) redirect('/dashboard/products')

  const { data: plans } = await supabase.from('plans').select('id, product_id, name, description, price, currency, billing_type, plan_identifier, interval, interval_count, trial_days, sort_order, asaas_plan_id, created_at').eq('product_id', id).order('created_at', { ascending: true })
  const { data: customization } = await supabase.from('checkout_customizations').select('draft_config, published_config, published_at').eq('product_id', id).maybeSingle()

  const initialConfig = normalizeCheckoutConfig(
    customization?.draft_config && Object.keys(customization.draft_config as object).length > 0
      ? customization.draft_config
      : defaultCheckoutConfig(product),
    product
  )

  return (
    <section className="overflow-hidden rounded-[10px] bg-white px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href={`/dashboard/products/${id}`} className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Editar checkout</h2>
            <p className="mt-2 text-sm text-slate-400">Personalize e visualize o checkout de {product.name} antes de publicar.</p>
          </div>
        </div>
      </div>

      <ProductTabs productId={id} active="checkout" />

      <div className="mt-8">
        <CheckoutEditorClient
          productId={id}
          userId={user.id}
          product={product}
          plans={plans || []}
          initialConfig={initialConfig}
          publishedAt={customization?.published_at || null}
        />
      </div>
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
