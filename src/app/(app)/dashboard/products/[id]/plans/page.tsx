import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Plus, ArrowRight, DollarSign, Package, Copy, ExternalLink } from 'lucide-react'
import { revalidatePath } from 'next/cache'

import { EditablePlanCard } from './EditablePlanCard'

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
      <main className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-4">
            <Link href={`/dashboard/products/${productId}`} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Gerenciar Planos</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Produto: <span className="font-bold text-slate-900">{product.name}</span>
              </p>
            </div>
          </div>
          
          <Link href={`/dashboard/products/${productId}/integrations`} className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-all shadow-sm text-sm">
            Integrações (Webhook)
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Form Column */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-slate-700" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Novo Plano</h2>
              </div>

              <form action={createPlan} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-2">Nome do Plano</label>
                  <input 
                    type="text" 
                    id="name" 
                    name="name" 
                    required 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm" 
                    placeholder="Ex: Profissional Mensal" 
                  />
                </div>

                <div>
                  <label htmlFor="price" className="block text-sm font-semibold text-slate-700 mb-2">Preço Mensal (R$)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                    <input 
                      type="number" 
                      id="price" 
                      name="price" 
                      min="0" 
                      step="0.01" 
                      required 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm" 
                      placeholder="97.00" 
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="plan_identifier" className="block text-sm font-semibold text-slate-700 mb-2">Identificador no SaaS <span className="text-slate-400 font-normal">(Opcional)</span></label>
                  <input 
                    type="text" 
                    id="plan_identifier" 
                    name="plan_identifier" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm" 
                    placeholder="Ex: pro" 
                  />
                  <p className="text-xs text-slate-500 mt-1">Identificador usado na integração para o seu sistema saber qual plano liberar.</p>
                </div>

                <button 
                  type="submit" 
                  className="w-full inline-flex items-center justify-center gap-2 bg-black hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-sm text-sm mt-2"
                >
                  <Save className="w-4 h-4" />
                  Adicionar Plano
                </button>
              </form>
            </div>
          </div>

          {/* Plans List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Planos Cadastrados</h2>
            
            {!plans || plans.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
                <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900 mb-1">Nenhum plano cadastrado</h3>
                <p className="text-sm text-slate-500">Crie seu primeiro plano ao lado para começar a cobrar assinantes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <EditablePlanCard key={plan.id} plan={plan} productId={productId} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
