import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Building2, CreditCard, Palette, Users } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { defaultCheckoutConfig, normalizeCheckoutConfig } from '@/lib/checkout-customization'
import { CheckoutEditorClient } from './CheckoutEditorClient'

export const dynamic = 'force-dynamic'

export default async function CheckoutEditorPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (!product) redirect('/dashboard/products')

  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .eq('product_id', id)
    .order('created_at', { ascending: true })

  const { data: customization } = await supabase
    .from('checkout_customizations')
    .select('draft_config, published_config, published_at')
    .eq('product_id', id)
    .maybeSingle()

  const initialConfig = normalizeCheckoutConfig(
    customization?.draft_config && Object.keys(customization.draft_config as object).length > 0
      ? customization.draft_config
      : defaultCheckoutConfig(product),
    product
  )

  return (
    <div className="w-full pb-12">
      <main className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center gap-4">
          <Link href={`/dashboard/products/${id}`} className="rounded-xl border border-white/10 bg-[#111] p-2.5 transition hover:bg-white/5">
            <ArrowLeft className="h-5 w-5 text-white/70" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">Editar checkout</h1>
            <p className="mt-1 text-sm text-white/50">Personalize e visualize o checkout de {product.name} antes de publicar.</p>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#111] p-2">
          <Tab href={`/dashboard/products/${id}`} icon={<Building2 className="h-4 w-4" />} label="Detalhes" />
          <Tab href={`/dashboard/products/${id}/plans`} icon={<CreditCard className="h-4 w-4" />} label="Planos" />
          <Tab href={`/dashboard/products/${id}/content`} icon={<BookOpen className="h-4 w-4" />} label="Conteúdo" />
          <Tab href={`/dashboard/products/${id}/journey`} icon={<Users className="h-4 w-4" />} label="Mentoria" />
          <Tab href={`/dashboard/products/${id}/checkout-editor`} icon={<Palette className="h-4 w-4" />} label="Checkout" active />
        </div>

        <CheckoutEditorClient
          productId={id}
          userId={user.id}
          product={product}
          plans={plans || []}
          initialConfig={initialConfig}
          publishedAt={customization?.published_at || null}
        />
      </main>
    </div>
  )
}

function Tab({ href, icon, label, active = false }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm transition ${active ? 'border border-white/5 bg-white/10 font-bold text-white' : 'font-semibold text-white/60 hover:bg-white/5 hover:text-white'}`}>
      {icon}
      {label}
    </Link>
  )
}
