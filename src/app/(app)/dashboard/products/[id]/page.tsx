import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Building2, CreditCard, Palette, Save, ShoppingBag, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  'Marketing & Negocios', 'Financas & Investimentos', 'Saude & Bem-estar',
  'Educacao', 'Tecnologia', 'Beleza & Moda', 'Esportes & Fitness',
  'Culinaria', 'Arte & Design', 'Outros',
]

const PRODUCT_TYPES = [
  { value: 'course', label: 'Curso Online' },
  { value: 'ebook', label: 'E-book / PDF' },
  { value: 'mentoria', label: 'Mentoria / Coaching' },
  { value: 'outros', label: 'Outros Infoprodutos' },
]

export default async function EditProductPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: product } = await supabase
    .from('products')
    .select('id, name, description, logo_url, cover_url, checkout_banner_url, checkout_video_url, category, product_type, delivery_type, delivery_url, image_url, price, currency, is_public, is_published, checkout_mode, created_at, owner_id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (!product) redirect('/dashboard/products')

  type ProductDetail = {
    id: string
    name: string
    description: string | null
    logo_url: string | null
    cover_url: string | null
    checkout_banner_url: string | null
    checkout_video_url: string | null
    category: string | null
    product_type: string | null
    delivery_type: string | null
    delivery_url: string | null
  }

  const productDetails = product as ProductDetail

  async function updateProduct(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const isPublic = formData.get('is_public') === 'on'

    await supabase
      .from('products')
      .update({
        name: formData.get('name') as string,
        description: formData.get('description') as string || null,
        site_url: null,
        logo_url: formData.get('logo_url') as string || null,
        cover_url: formData.get('cover_url') as string || null,
        checkout_banner_url: formData.get('checkout_banner_url') as string || null,
        checkout_video_url: formData.get('checkout_video_url') as string || null,
        category: formData.get('category') as string || 'Outros',
        product_type: formData.get('product_type') as string || 'outros',
        commission_rate: 0,
        is_public: isPublic,
        delivery_type: formData.get('delivery_type') as string || 'external',
        delivery_url: formData.get('delivery_url') as string || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('owner_id', user.id)

    redirect(`/dashboard/products/${id}?saved=1`)
  }

  const p = productDetails

  return (
    <section className="overflow-hidden rounded-[10px] bg-card px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/dashboard/products" className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Produto</h2>
            <p className="mt-2 text-sm text-muted">Edite informacoes, entrega e configuracoes de {product.name}.</p>
          </div>
        </div>
        <button form="product-details-form" type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600">
          <Save className="h-4 w-4" />
          Salvar
        </button>
      </div>

      <ProductTabs productId={id} active="details" />

      <form id="product-details-form" action={updateProduct} className="mt-10 max-w-6xl">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-[#f8fafc] px-5 py-4 mb-6">
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" name="is_public" defaultChecked={product.is_public} className="peer sr-only" />
            <div className="h-6 w-11 rounded-full bg-surface after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-card after:transition-all peer-checked:bg-orange-500 peer-checked:after:translate-x-full" />
          </label>
          <div>
            <span className="text-sm font-semibold text-foreground">{product.is_public ? 'Publicado' : 'Rascunho'}</span>
            <p className="text-xs text-muted">Quando publicado, o checkout fica acessivel para compradores.</p>
          </div>
        </div>

        <div className="grid border-y border-border md:grid-cols-[240px_1fr]">
          <RowTitle title="Informacoes" description="Nome, tipo, categoria e descricao." />
          <div className="space-y-5 py-6 md:pl-8">
            <Field label="Nome do produto" required>
              <input className={inputClass} type="text" name="name" defaultValue={p.name} required />
            </Field>
            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="Tipo de produto">
                <select className={inputClass} name="product_type" defaultValue={p.product_type || 'outros'}>
                  {PRODUCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Categoria">
                <select className={inputClass} name="category" defaultValue={p.category || 'Outros'}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Descricao">
              <textarea className={textareaClass} name="description" rows={4} defaultValue={p.description || ''} placeholder="Descreva seu produto..." />
            </Field>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600">
            <Save className="h-4 w-4" />
            Salvar alteracoes
          </button>
        </div>
      </form>
    </section>
  )
}

const inputClass = 'h-12 w-full rounded-xl border-0 bg-surface px-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted focus:bg-card focus:ring-2 focus:ring-orange-500/20'
const textareaClass = 'w-full resize-none rounded-xl border-0 bg-surface px-4 py-3 text-sm font-medium leading-6 text-foreground outline-none transition placeholder:text-muted focus:bg-card focus:ring-2 focus:ring-orange-500/20'

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
    <div className="mt-8 flex gap-2 overflow-x-auto border-b border-border">
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = tab.key === active
        return (
          <Link key={tab.key} href={tab.href} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${isActive ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted hover:text-foreground'}`}>
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}

function RowTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-6 md:pr-8">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
    </div>
  )
}

function Field({ label, required = false, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">
        {label}{required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-2 block text-xs leading-5 text-muted">{hint}</span>}
    </label>
  )
}
