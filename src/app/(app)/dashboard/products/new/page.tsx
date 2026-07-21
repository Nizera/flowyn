import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BadgeCheck, Lock, AlertTriangle } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getPlatformAccess } from '@/lib/platform-access'
import { checkPlanLimit } from '@/lib/subscription'
import { ProductWizard } from './ProductWizard'

type CreateProductPlan = {
  name: string
  price: string | number
  billing_type: 'one_time' | 'recurring'
}

type CreateProductActionInput = {
  name: string
  description: string
  short_description?: string
  logo_url?: string
  cover_url?: string
  checkout_banner_url?: string
  checkout_video_url?: string
  category: string
  product_type: string
  delivery_type: string
  delivery_url?: string
  deliverable_file_paths?: string[]
  order_bump_enabled?: boolean
  order_bump_title?: string
  order_bump_description?: string
  order_bump_price?: string
  order_bump_discount_percent?: string
  order_bump_file_paths?: string[]
  order_bump_image_url?: string
  plans?: CreateProductPlan[]
}

async function createProductAction(data: CreateProductActionInput): Promise<{ productId: string } | { error: string }> {
  'use server'
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: 'Sessão expirada. Faça login novamente.' }
    }

    const access = await getPlatformAccess(user.id)
    if (!access.allowed) {
      return { error: 'Sua assinatura Flowyn Pro precisa estar ativa para criar produtos.' }
    }

    const limit = await checkPlanLimit(user.id, 'products')
    if (!limit.allowed) {
      return { error: `Voce atingiu o limite de ${limit.max} produto(s) do plano gratuito. Atualize para o plano Pro para criar mais.` }
    }

    const deliverablePaths = data.deliverable_file_paths ?? []
    const orderBumpFilePaths = data.order_bump_file_paths ?? []
    const productPlans = data.plans ?? []

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        owner_id: user.id,
        name: data.name,
        description: data.description,
        short_description: data.short_description || null,
        logo_url: data.logo_url || null,
        cover_url: data.cover_url || null,
        site_url: null,
        category: data.category,
        product_type: data.product_type,
        is_public: false,
        commission_rate: 0,
        checkout_banner_url: data.checkout_banner_url || null,
        checkout_video_url: data.checkout_video_url || null,
        delivery_type: data.delivery_type,
        delivery_url: data.delivery_url || null,
        deliverable_file_paths: deliverablePaths.length > 0 ? deliverablePaths : null,
        order_bump_title: data.order_bump_enabled ? data.order_bump_title : null,
        order_bump_description: data.order_bump_enabled ? data.order_bump_description : null,
        order_bump_price: data.order_bump_enabled && data.order_bump_price ? parseFloat(data.order_bump_price) : null,
        order_bump_discount_percent: data.order_bump_enabled && data.order_bump_discount_percent ? parseFloat(data.order_bump_discount_percent) : null,
        order_bump_file_paths: data.order_bump_enabled && orderBumpFilePaths.length > 0 ? orderBumpFilePaths : null,
        order_bump_image_url: data.order_bump_enabled ? data.order_bump_image_url || null : null,
      })
      .select('id')
      .single()

    if (error || !product) {
      console.error('[createProductAction] DB Error:', error)
      return { error: `Erro ao criar produto: ${error?.message || 'resposta vazia do banco'}` }
    }

    if (productPlans.length > 0) {
      const plans = productPlans.map((p: CreateProductPlan) => ({
        product_id: product.id,
        name: p.name,
        price: typeof p.price === 'string' ? parseFloat(p.price) || 0 : p.price,
        billing_type: p.billing_type === 'recurring' ? 'recurring' : 'one_time',
      }))

      const invalidPlan = plans.find(p => !Number.isFinite(p.price) || p.price < 5)
      if (invalidPlan) {
        return { error: 'O valor minimo de um plano e de R$ 5,00.' }
      }
      const { error: plansError } = await supabase.from('plans').insert(plans)
      if (plansError) {
        console.error('[createProductAction] Plans Error:', plansError)
        return { error: `Produto criado, mas erro ao salvar planos: ${plansError.message}` }
      }
    }

    return { productId: product.id }
  } catch (err) {
    console.error('[createProductAction] Erro inesperado:', err)
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return { error: `Erro inesperado: ${message}` }
  }
}

export default async function NewProductPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const access = await getPlatformAccess(user.id)
  const limit = await checkPlanLimit(user.id, 'products')

  if (!access.allowed) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-950">Assinatura necessaria</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Para manter a Flowyn sem taxa por venda, a criacao de produtos fica liberada para contas em teste gratis, ativas ou em regularizacao.
          </p>
          <Link href="/dashboard/settings/subscription" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-black text-white transition hover:from-orange-600 hover:to-amber-600">
            <BadgeCheck className="h-4 w-4" />
            Ativar Flowyn Pro
          </Link>
        </div>
      </div>
    )
  }

  if (!limit.allowed) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-950">Limite atingido</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Voce ja criou <strong>{limit.max} produto(s)</strong> no plano gratuito. Atualize para o plano Pro para criar quantos produtos precisar.
          </p>
          <Link href="/dashboard/settings/subscription" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-black text-white transition hover:from-orange-600 hover:to-amber-600">
            <BadgeCheck className="h-4 w-4" />
            Atualizar para Pro
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      {limit.plan === 'free' && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>
            {limit.current === 0
              ? `Este sera seu ${limit.max}o produto(s) permitido(s) no plano gratuito. Apos criar, sera necessario atualizar para o plano Pro para criar mais.`
              : `Voce esta usando ${limit.current} de ${limit.max} produto(s) do plano gratuito. Apos criar este produto, sera necessario atualizar para o plano Pro para criar mais.`
            }
          </p>
        </div>
      )}
      <ProductWizard createProductAction={createProductAction} userId={user.id} />
    </>
  )
}
