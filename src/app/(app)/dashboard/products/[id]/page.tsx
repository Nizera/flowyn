import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Building2, Link as LinkIcon,
  Percent, CreditCard, Package, Globe, Lock, Truck, BookOpen, Users, Palette
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  'Marketing & Negócios', 'Finanças & Investimentos', 'Saúde & Bem-estar',
  'Educação', 'Tecnologia', 'Beleza & Moda', 'Esportes & Fitness',
  'Culinária', 'Arte & Design', 'Outros',
]

const PRODUCT_TYPES = [
  { value: 'course',   label: 'Curso Online' },
  { value: 'ebook',    label: 'E-book / PDF' },
  { value: 'mentoria', label: 'Mentoria / Coaching' },
  { value: 'outros',   label: 'Outros Infoprodutos' },
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
        site_url: formData.get('site_url') as string || null,
        logo_url: formData.get('logo_url') as string || null,
        cover_url: formData.get('cover_url') as string || null,
        checkout_banner_url: formData.get('checkout_banner_url') as string || null,
        checkout_video_url: formData.get('checkout_video_url') as string || null,
        category: formData.get('category') as string || 'Outros',
        product_type: formData.get('product_type') as string || 'outros',
        commission_rate: parseFloat(formData.get('commission_rate') as string) || 40,
        is_public: formData.get('is_public') === 'true',
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
      <main className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard/products" className="p-2.5 bg-[#111111] border border-white/10 rounded-xl hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Gerenciar: {product.name}</h1>
            <p className="text-white/50 text-sm mt-0.5">Edite as informações, preços e configurações do produto.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#111111] rounded-2xl border border-white/10 p-2 gap-2 mb-10 overflow-x-auto">
          <Link href={`/dashboard/products/${id}`}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white font-bold rounded-xl border border-white/5">
            <Building2 className="w-4 h-4" /> Detalhes
          </Link>
          <Link href={`/dashboard/products/${id}/plans`}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-white/60 hover:bg-white/5 hover:text-white font-medium rounded-xl transition-colors">
            <CreditCard className="w-4 h-4" /> Planos de Venda
          </Link>
          <Link href={`/dashboard/products/${id}/content`}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-white/60 hover:bg-white/5 hover:text-white font-medium rounded-xl transition-colors">
            <BookOpen className="w-4 h-4" /> Conteúdo
          </Link>
          <Link href={`/dashboard/products/${id}/journey`}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-white/60 hover:bg-white/5 hover:text-white font-medium rounded-xl transition-colors">
            <Users className="w-4 h-4" /> Mentoria
          </Link>
          <Link href={`/dashboard/products/${id}/checkout-editor`}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-white/60 hover:bg-white/5 hover:text-white font-medium rounded-xl transition-colors">
            <Palette className="w-4 h-4" /> Editar Checkout
          </Link>
        </div>

        <form action={updateProduct} className="space-y-6">

          {/* 1. Basic Info */}
          <div className="bg-[#111111] border border-white/10 rounded-3xl p-8">
            <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#00e88a]" /> Informações Básicas
            </h2>
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className={labelClass}>Nome do Produto <span className="text-[#00e88a]">*</span></label>
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
                  <label className={labelClass}>Descrição</label>
                  <textarea className={`${inputClass} resize-none`} name="description" rows={3}
                    defaultValue={p.description || ''} placeholder="Descreva seu produto..." />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Media */}
          <div className="bg-[#111111] border border-white/10 rounded-3xl p-8">
            <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-[#00e88a]" /> Links e Mídia
            </h2>
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Logo / Thumbnail (URL)</label>
                  <input className={inputClass} type="url" name="logo_url" defaultValue={p.logo_url || ''} placeholder="https://..." />
                </div>
                <div>
                  <label className={labelClass}>Página de Vendas (URL)</label>
                  <input className={inputClass} type="url" name="site_url" defaultValue={p.site_url || ''} placeholder="https://..." />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Imagem de Capa da Vitrine (URL)</label>
                  <input className={inputClass} type="url" name="cover_url" defaultValue={p.cover_url || ''} placeholder="https://... (1200×630px recomendado)" />
                  {p.cover_url && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-white/10 h-40">
                      <img src={p.cover_url} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Banner do Checkout (URL)</label>
                  <input className={inputClass} type="url" name="checkout_banner_url" defaultValue={p.checkout_banner_url || ''} placeholder="https://..." />
                </div>
                <div>
                  <label className={labelClass}>Vídeo de Vendas (YouTube / Vimeo)</label>
                  <input className={inputClass} type="url" name="checkout_video_url" defaultValue={p.checkout_video_url || ''} placeholder="https://youtube.com/..." />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Delivery */}
          <div className="bg-[#111111] border border-white/10 rounded-3xl p-8">
            <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#00e88a]" /> Entrega do Produto
            </h2>
            <div className="space-y-5">
              <div>
                <label className={labelClass}>Tipo de Entrega</label>
                <div className="flex gap-3">
                  {[
                    { value: 'platform', label: '🎓 Área de Membros Flowyn' },
                    { value: 'external', label: '🔗 Link Externo' },
                  ].map(dt => (
                    <label key={dt.value} className="flex-1 cursor-pointer">
                      <input type="radio" name="delivery_type" value={dt.value}
                        defaultChecked={p.delivery_type === dt.value || (!p.delivery_type && dt.value === 'external')}
                        className="sr-only peer" />
                      <div className="py-3 rounded-xl border border-white/10 text-sm font-semibold text-white/50 text-center
                        peer-checked:border-[#00e88a] peer-checked:bg-[#00e88a]/10 peer-checked:text-[#00e88a] transition-all">
                        {dt.label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Link de Entrega Pós-Compra</label>
                <input className={inputClass} type="url" name="delivery_url" defaultValue={p.delivery_url || ''} placeholder="https://... (enviado ao comprador após o pagamento)" />
                <p className="text-xs text-white/40 mt-1">Deixe vazio se usar a Área de Membros Flowyn</p>
              </div>
            </div>
          </div>

          {/* 4. Commission & Visibility */}
          <div className="bg-[#111111] border border-white/10 rounded-3xl p-8">
            <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <Percent className="w-4 h-4 text-[#00e88a]" /> Afiliação & Visibilidade
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Comissão para Afiliados (%)</label>
                <div className="relative">
                  <input className={`${inputClass} pr-10 text-lg font-bold`} type="number" name="commission_rate"
                    min="0" max="90" step="1" defaultValue={p.commission_rate} />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">%</span>
                </div>
              </div>
              <div>
                <label className={labelClass}>Visibilidade na Vitrine</label>
                <div className="flex gap-3">
                  {[
                    { value: 'true', label: <><Globe className="w-4 h-4" /> Público</>, active: p.is_public !== false },
                    { value: 'false', label: <><Lock className="w-4 h-4" /> Privado</>, active: p.is_public === false },
                  ].map(v => (
                    <label key={String(v.value)} className="flex-1 cursor-pointer">
                      <input type="radio" name="is_public" value={v.value} defaultChecked={v.active} className="sr-only peer" />
                      <div className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-sm font-semibold text-white/50
                        peer-checked:border-[#00e88a] peer-checked:bg-[#00e88a]/10 peer-checked:text-[#00e88a] transition-all">
                        {v.label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 5. Order Bump */}
          <div className="bg-[#111111] border border-white/10 rounded-3xl p-8">
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#00e88a]" /> Order Bump
            </h2>
            <p className="text-sm text-white/50 mb-6">Oferta adicional exibida no checkout junto com o produto principal.</p>
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Título do Order Bump</label>
                  <input className={inputClass} name="order_bump_title" defaultValue={p.order_bump_title || ''} placeholder="Ex: Planilha Bônus por apenas R$ 9,90" />
                </div>
                <div>
                  <label className={labelClass}>Descrição</label>
                  <input className={inputClass} name="order_bump_description" defaultValue={p.order_bump_description || ''} placeholder="O que está sendo oferecido?" />
                </div>
                <div>
                  <label className={labelClass}>Preço (R$)</label>
                  <input className={inputClass} type="number" name="order_bump_price" min="0" step="0.01"
                    defaultValue={p.order_bump_price || ''} placeholder="9.90" />
                </div>
                <div>
                  <label className={labelClass}>Desconto (%)</label>
                  <input className={inputClass} type="number" name="order_bump_discount_percent" min="0" max="100"
                    defaultValue={p.order_bump_discount_percent || ''} placeholder="50" />
                </div>
              </div>
              <p className="text-xs text-white/40">Deixe o título vazio para desativar o order bump.</p>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button type="submit"
              className="inline-flex items-center gap-2 bg-[#00e88a] hover:bg-[#00e88a]/90 text-black font-bold py-3 px-8 rounded-xl transition-all shadow-[0_0_15px_rgba(0,232,138,0.3)]">
              <Save className="w-5 h-5" /> Salvar Alterações
            </button>
          </div>

        </form>
      </main>
    </div>
  )
}
