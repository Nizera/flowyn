import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Plus, ArrowRight, DollarSign, Package, Copy, ExternalLink } from 'lucide-react'
import { revalidatePath } from 'next/cache'

import { EditablePlanCard } from './EditablePlanCard'
import { PlanPixelSection } from './PlanPixelSection'

export default async function PlansPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const productId = params.id
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single()

  if (!product || product.owner_id !== user.id) {
    redirect('/dashboard')
  }

  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })

  // Fetch the producer's global pixels
  const { data: userPixels } = await supabase
    .from('pixels')
    .select('id, name, platform, pixel_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('name')

  // Fetch plan_pixels for all plans of this product
  const planIds = (plans ?? []).map(p => p.id)
  const { data: allPlanPixels } = planIds.length > 0
    ? await supabase
        .from('plan_pixels')
        .select('id, plan_id, pixel:pixels(id, name, platform, pixel_id)')
        .in('plan_id', planIds)
    : { data: [] }

  async function createPlan(formData: FormData) {
    'use server'
    const name = formData.get('name') as string
    const price = formData.get('price') as string
    const plan_identifier = formData.get('plan_identifier') as string

    if (!name || !price) return

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    await supabase
      .from('plans')
      .insert({
        product_id: productId,
        name,
        price: parseFloat(price),
        plan_identifier: plan_identifier || null
      })

    revalidatePath(`/dashboard/products/${productId}/plans`)
  }

  return (
    <div className="w-full pb-12">
      <main className="max-w-5xl mx-auto px-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-4">
            <Link href={`/dashboard/products/${productId}`} className="p-2.5 bg-[#111111] border border-white/10 rounded-xl hover:bg-white/5 transition-colors shadow-xl">
              <ArrowLeft className="w-5 h-5 text-white/70" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Gerenciar Planos</h1>
              <p className="text-white/50 text-sm mt-0.5">
                Produto: <span className="font-bold text-white">{product.name}</span>
              </p>
            </div>
          </div>
          
          <Link href={`/dashboard/products/${productId}/integrations`} className="inline-flex items-center gap-2 bg-[#111111] border border-white/10 text-white/70 font-semibold px-5 py-2.5 rounded-xl hover:bg-white/5 hover:text-white transition-all shadow-xl text-sm">
            Integrações (Webhook)
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Form Column */}
          <div className="lg:col-span-1">
            <div className="bg-[#111111] border border-white/10 rounded-2xl shadow-xl p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-[#00e88a]" />
                </div>
                <h2 className="text-lg font-bold text-white">Novo Plano</h2>
              </div>

              <form action={createPlan} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-white/70 mb-2">Nome do Plano</label>
                  <input 
                    type="text" 
                    id="name" 
                    name="name" 
                    required 
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] transition-all outline-none text-sm" 
                    placeholder="Ex: Profissional Mensal" 
                  />
                </div>

                <div>
                  <label htmlFor="price" className="block text-sm font-semibold text-white/70 mb-2">Preço Mensal (R$)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold text-sm">R$</span>
                    <input 
                      type="number" 
                      id="price" 
                      name="price" 
                      min="0" 
                      step="0.01" 
                      required 
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] transition-all outline-none text-sm" 
                      placeholder="97.00" 
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="plan_identifier" className="block text-sm font-semibold text-white/70 mb-2">Identificador no SaaS <span className="text-white/40 font-normal">(Opcional)</span></label>
                  <input 
                    type="text" 
                    id="plan_identifier" 
                    name="plan_identifier" 
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] transition-all outline-none text-sm" 
                    placeholder="Ex: pro" 
                  />
                  <p className="text-xs text-white/40 mt-1">Identificador usado na integração para o seu sistema saber qual plano liberar.</p>
                </div>

                <button 
                  type="submit" 
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#00e88a] hover:bg-[#00e88a]/90 text-black font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(0,232,138,0.3)] hover:shadow-[0_0_25px_rgba(0,232,138,0.5)] text-sm mt-2"
                >
                  <Save className="w-4 h-4" />
                  Adicionar Plano
                </button>
              </form>
            </div>
          </div>

          {/* Plans List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-white mb-2">Planos Cadastrados</h2>
            
            {!plans || plans.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-2xl">
                <DollarSign className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">Nenhum plano cadastrado</h3>
                <p className="text-sm text-white/50">Crie seu primeiro plano ao lado para começar a cobrar assinantes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => {
                  const planPixels = (allPlanPixels ?? [])
                    .filter(pp => pp.plan_id === plan.id)
                    .map(pp => ({ id: pp.id, pixel: pp.pixel as any }))
                  return (
                    <div key={plan.id} className="bg-[#111111] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
                      <EditablePlanCard plan={plan} productId={productId} />
                      <PlanPixelSection
                        planId={plan.id}
                        planPixels={planPixels}
                        availablePixels={(userPixels ?? []) as any}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
