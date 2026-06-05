import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Building2, CreditCard, Link as LinkIcon, Package, Palette, Save, Truck, Users } from 'lucide-react'

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
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (!product) redirect('/dashboard/products')

  async function updateProduct(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

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
        is_public: false,
        is_flowyn_saas: false,
        delivery_type: formData.get('delivery_type') as string || 'external',
        delivery_url: formData.get('delivery_url') as string || null,
        order_bump_title: formData.get('order_bump_title') as string || null,
        order_bump_description: formData.get('order_bump_description') as string || null,
        order_bump_price: formData.get('order_bump_price') ? parseFloat(formData.get('order_bump_price') as string) : null,
        order_bump_discount_percent: formData.get('order_bump_discount_percent') ? parseFloat(formData.get('order_bump_discount_percent') as string) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('owner_id', user.id)

    redirect(`/dashboard/products/${id}?saved=1`)
  }

  const p = product as any
  const inputClass = 'w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] transition-all outline-none'
  const labelClass = 'block text-sm font-semibold text-white/70 mb-2'

  return (
    <div className="w-full pb-12">
      <main className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/dashboard/products" className="rounded-xl border border-white/10 bg-[#111111] p-2.5 transition-colors hover:bg-white/5">
            <ArrowLeft className="h-5 w-5 text-white/70" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Gerenciar: {product.name}</h1>
            <p className="mt-0.5 text-sm text-white/50">Edite informacoes, entrega e configuracoes do checkout.</p>
          </div>
        </div>

        <div className="mb-10 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#111111] p-2">
          <Tab href={`/dashboard/products/${id}`} icon={<Building2 className="h-4 w-4" />} label="Detalhes" active />
          <Tab href={`/dashboard/products/${id}/plans`} icon={<CreditCard className="h-4 w-4" />} label="Planos" />
          <Tab href={`/dashboard/products/${id}/content`} icon={<BookOpen className="h-4 w-4" />} label="Conteudo" />
          <Tab href={`/dashboard/products/${id}/journey`} icon={<Users className="h-4 w-4" />} label="Mentoria" />
          <Tab href={`/dashboard/products/${id}/checkout-editor`} icon={<Palette className="h-4 w-4" />} label="Checkout" />
        </div>

        <form action={updateProduct} className="space-y-6">
          <Panel title="Informacoes Basicas" icon={<Building2 className="h-4 w-4 text-[#00e88a]" />}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>Nome do Produto *</label>
                <input className={inputClass} type="text" name="name" defaultValue={p.name} required />
              </div>
              <div>
                <label className={labelClass}>Tipo de Produto</label>
                <select className={inputClass} name="product_type" defaultValue={p.product_type || 'outros'}>
                  {PRODUCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Categoria</label>
                <select className={inputClass} name="category" defaultValue={p.category || 'Outros'}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Descricao</label>
                <textarea className={`${inputClass} resize-none`} name="description" rows={3} defaultValue={p.description || ''} placeholder="Descreva seu produto..." />
              </div>
            </div>
          </Panel>

          <Panel title="Midia do Checkout" icon={<LinkIcon className="h-4 w-4 text-[#00e88a]" />}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>Logo / Thumbnail (URL)</label>
                <input className={inputClass} type="url" name="logo_url" defaultValue={p.logo_url || ''} placeholder="https://..." />
              </div>
              <div>
                <label className={labelClass}>Imagem de Capa (URL)</label>
                <input className={inputClass} type="url" name="cover_url" defaultValue={p.cover_url || ''} placeholder="https://..." />
              </div>
              <div>
                <label className={labelClass}>Banner do Checkout (URL)</label>
                <input className={inputClass} type="url" name="checkout_banner_url" defaultValue={p.checkout_banner_url || ''} placeholder="https://..." />
              </div>
              <div>
                <label className={labelClass}>Video de Vendas (YouTube / Vimeo)</label>
                <input className={inputClass} type="url" name="checkout_video_url" defaultValue={p.checkout_video_url || ''} placeholder="https://youtube.com/..." />
              </div>
            </div>
          </Panel>

          <Panel title="Entrega do Produto" icon={<Truck className="h-4 w-4 text-[#00e88a]" />}>
            <div className="space-y-5">
              <div>
                <label className={labelClass}>Tipo de Entrega</label>
                <div className="flex gap-3">
                  {[
                    { value: 'platform', label: 'Area de Membros Flowyn' },
                    { value: 'external', label: 'Link Externo' },
                  ].map(dt => (
                    <label key={dt.value} className="flex-1 cursor-pointer">
                      <input type="radio" name="delivery_type" value={dt.value} defaultChecked={p.delivery_type === dt.value || (!p.delivery_type && dt.value === 'external')} className="sr-only peer" />
                      <div className="rounded-xl border border-white/10 py-3 text-center text-sm font-semibold text-white/50 transition-all peer-checked:border-[#00e88a] peer-checked:bg-[#00e88a]/10 peer-checked:text-[#00e88a]">
                        {dt.label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Link de Entrega Pos-Compra</label>
                <input className={inputClass} type="url" name="delivery_url" defaultValue={p.delivery_url || ''} placeholder="https://... (enviado ao comprador apos o pagamento)" />
                <p className="mt-1 text-xs text-white/40">Deixe vazio se usar a Area de Membros Flowyn</p>
              </div>
            </div>
          </Panel>

          <Panel title="Order Bump" icon={<Package className="h-4 w-4 text-[#00e88a]" />}>
            <p className="mb-6 text-sm text-white/50">Oferta adicional exibida no checkout junto com o produto principal.</p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>Titulo do Order Bump</label>
                <input className={inputClass} name="order_bump_title" defaultValue={p.order_bump_title || ''} placeholder="Ex: Planilha bonus por R$ 9,90" />
              </div>
              <div>
                <label className={labelClass}>Descricao</label>
                <input className={inputClass} name="order_bump_description" defaultValue={p.order_bump_description || ''} placeholder="O que esta sendo oferecido?" />
              </div>
              <div>
                <label className={labelClass}>Preco (R$)</label>
                <input className={inputClass} type="number" name="order_bump_price" min="0" step="0.01" defaultValue={p.order_bump_price || ''} placeholder="9.90" />
              </div>
              <div>
                <label className={labelClass}>Desconto (%)</label>
                <input className={inputClass} type="number" name="order_bump_discount_percent" min="0" max="100" defaultValue={p.order_bump_discount_percent || ''} placeholder="50" />
              </div>
            </div>
          </Panel>

          <div className="flex justify-end">
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#00e88a] px-8 py-3 font-bold text-black shadow-[0_0_15px_rgba(0,232,138,0.3)] transition-all hover:bg-[#00e88a]/90">
              <Save className="h-5 w-5" /> Salvar Alteracoes
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

function Tab({ href, icon, label, active = false }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link href={href} className={`flex-shrink-0 flex items-center gap-2 rounded-xl px-5 py-2.5 transition-colors ${active ? 'border border-white/5 bg-white/10 font-bold text-white' : 'font-medium text-white/60 hover:bg-white/5 hover:text-white'}`}>
      {icon} {label}
    </Link>
  )
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#111111] p-8">
      <h2 className="mb-6 flex items-center gap-2 text-base font-bold text-white">{icon} {title}</h2>
      {children}
    </div>
  )
}
