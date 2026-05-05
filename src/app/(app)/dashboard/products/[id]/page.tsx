import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Building2, Link as LinkIcon, Image as ImageIcon, Percent, Webhook, CreditCard } from 'lucide-react'
import { IntegrationChecklist } from '@/components/IntegrationChecklist'

export const dynamic = 'force-dynamic'

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

  if (!product) {
    redirect('/dashboard/products')
  }

  async function updateProduct(formData: FormData) {
    'use server'
    const name = formData.get('name') as string
    const site_url = formData.get('site_url') as string
    const logo_url = formData.get('logo_url') as string
    const cover_url = formData.get('cover_url') as string
    const category = formData.get('category') as string
    const commission_rate = formData.get('commission_rate') as string
    const description = formData.get('description') as string

    if (!name) return

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    await supabase
      .from('products')
      .update({
        name,
        site_url,
        logo_url,
        cover_url,
        category: category || 'outros',
        commission_rate: parseFloat(commission_rate) || 50
      })
      .eq('id', id)
      .eq('owner_id', user.id)

    redirect('/dashboard/products')
  }

  return (
    <div className="w-full pb-12">
      <main className="max-w-4xl mx-auto px-6">
        
        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard/products" className="p-2.5 bg-[#111111] border border-white/10 rounded-xl hover:bg-white/5 transition-colors shadow-xl">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Gerenciar: {product.name}</h1>
            <p className="text-white/50 text-sm mt-0.5">Edite as informações ou acesse as configurações avançadas.</p>
          </div>
        </div>

        {/* Quick Nav Tabs */}
        <div className="flex bg-[#111111] rounded-2xl border border-white/10 p-2 gap-2 mb-10 overflow-x-auto shadow-xl">
          <Link href={`/dashboard/products/${id}`} className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white font-bold rounded-xl border border-white/5">
            <Building2 className="w-4 h-4" />
            Detalhes do Produto
          </Link>
          <Link href={`/dashboard/products/${id}/plans`} className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-white/60 hover:bg-white/5 hover:text-white font-medium rounded-xl transition-colors">
            <CreditCard className="w-4 h-4" />
            Planos de Venda
          </Link>
          <Link href={`/dashboard/products/${id}/integrations`} className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-white/60 hover:bg-white/5 hover:text-white font-medium rounded-xl transition-colors">
            <Webhook className="w-4 h-4" />
            Webhooks / Integração
          </Link>
        </div>

        {/* Integration Checklist */}
        <IntegrationChecklist productId={id} />

        {/* Form */}
        <form action={updateProduct} className="bg-[#111111] border border-white/10 rounded-3xl p-8 shadow-xl">

          {/* Section 1: Basic Info */}
          <div className="mb-10">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-[#00e88a]" />
              </span>
              Informações Básicas
            </h2>

            <div className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-white/70 mb-2">
                  Nome do Produto <span className="text-[#00e88a]">*</span>
                </label>
                <input 
                  type="text" 
                  id="name" 
                  name="name" 
                  defaultValue={product.name}
                  required 
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] transition-all outline-none shadow-sm" 
                />
              </div>
            </div>
          </div>

          <hr className="border-white/5 mb-10" />

          {/* Section 2: Links & Media */}
          <div className="mb-10">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <LinkIcon className="w-4 h-4 text-[#00e88a]" />
              </span>
              Links e Mídia
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="site_url" className="block text-sm font-semibold text-white/70 mb-2">
                  Página de Vendas
                </label>
                <input 
                  type="url" 
                  id="site_url" 
                  name="site_url" 
                  defaultValue={product.site_url || ''}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] transition-all outline-none shadow-sm" 
                />
              </div>
              <div>
                <label htmlFor="logo_url" className="block text-sm font-semibold text-white/70 mb-2">
                  URL da Logo
                </label>
                <input 
                  type="url" 
                  id="logo_url" 
                  name="logo_url" 
                  defaultValue={product.logo_url || ''}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] transition-all outline-none shadow-sm" 
                />
              </div>
            </div>

            {/* Cover Image + Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <div className="md:col-span-2">
                <label htmlFor="cover_url" className="block text-sm font-semibold text-white/70 mb-2">
                  Imagem de Capa da Vitrine
                  <span className="text-white/30 font-normal ml-1">(URL — recomendado 1200×630px)</span>
                </label>
                <input 
                  type="url" 
                  id="cover_url" 
                  name="cover_url" 
                  defaultValue={(product as any).cover_url || ''}
                  placeholder="https://exemplo.com/capa.jpg"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] transition-all outline-none shadow-sm" 
                />
                {(product as any).cover_url && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-white/10 h-40">
                    <img src={(product as any).cover_url} alt="Preview da capa" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-semibold text-white/70 mb-2">
                  Categoria / Nicho
                </label>
                <select
                  id="category"
                  name="category"
                  defaultValue={(product as any).category || 'outros'}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3.5 px-4 text-white focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] transition-all outline-none shadow-sm"
                >
                  <option value="saas">SaaS / Software</option>
                  <option value="cursos">Cursos Online</option>
                  <option value="saude">Saúde &amp; Bem-estar</option>
                  <option value="financas">Finanças &amp; Investimentos</option>
                  <option value="marketing">Marketing &amp; Negócios</option>
                  <option value="educacao">Educação</option>
                  <option value="beleza">Beleza &amp; Moda</option>
                  <option value="tecnologia">Tecnologia</option>
                  <option value="entretenimento">Entretenimento</option>
                  <option value="outros">Outros</option>
                </select>
              </div>
            </div>
          </div>

          <hr className="border-white/5 mb-10" />

          {/* Section 3: Commission */}
          <div className="mb-10">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Percent className="w-4 h-4 text-[#00e88a]" />
              </span>
              Comissão do Afiliado
            </h2>

            <div className="max-w-xs">
              <label htmlFor="commission_rate" className="block text-sm font-semibold text-white/70 mb-2">
                Taxa de Comissão (%) <span className="text-[#00e88a]">*</span>
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  id="commission_rate" 
                  name="commission_rate" 
                  min="0" 
                  max="100" 
                  step="0.01" 
                  defaultValue={product.commission_rate} 
                  required 
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3.5 px-4 pr-12 text-white text-lg font-bold focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] transition-all outline-none shadow-sm" 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 font-bold text-lg">%</span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end pt-6 border-t border-white/5">
            <button 
              type="submit" 
              className="inline-flex items-center gap-2 bg-[#00e88a] hover:bg-[#00e88a]/90 text-black font-bold py-3.5 px-8 rounded-xl transition-all shadow-[0_0_15px_rgba(0,232,138,0.3)] hover:shadow-[0_0_25px_rgba(0,232,138,0.5)]"
            >
              <Save className="w-5 h-5" />
              Salvar Alterações
            </button>
          </div>
        </form>

      </main>
    </div>
  )
}
