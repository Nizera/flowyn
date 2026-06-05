import { redirect } from 'next/navigation'
import Link from 'next/link'
import crypto from 'crypto'
import { BadgeCheck, Lock } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getPlatformAccess } from '@/lib/platform-access'
import { ProductWizard } from './ProductWizard'

async function createProductAction(data: any): Promise<{ error: string } | void> {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getPlatformAccess(user.id)
  if (!access.allowed) {
    return { error: 'Sua assinatura Flowyn Pro precisa estar ativa para criar produtos.' }
  }

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
      is_flowyn_saas: false,
      commission_rate: 0,
      checkout_banner_url: data.checkout_banner_url || null,
      checkout_video_url: data.checkout_video_url || null,
      delivery_type: data.delivery_type,
      delivery_url: data.delivery_url || null,
      deliverable_file_paths: data.deliverable_file_paths?.length > 0 ? data.deliverable_file_paths : null,
      order_bump_title: data.order_bump_enabled ? data.order_bump_title : null,
      order_bump_description: data.order_bump_enabled ? data.order_bump_description : null,
      order_bump_price: data.order_bump_enabled && data.order_bump_price ? parseFloat(data.order_bump_price) : null,
      order_bump_discount_percent: data.order_bump_enabled && data.order_bump_discount_percent ? parseFloat(data.order_bump_discount_percent) : null,
      order_bump_file_paths: data.order_bump_enabled && data.order_bump_file_paths?.length > 0 ? data.order_bump_file_paths : null,
      order_bump_image_url: data.order_bump_enabled ? data.order_bump_image_url || null : null,
    })
    .select('id')
    .single()

  if (error || !product) {
    console.error('[createProductAction] DB Error:', error)
    return { error: `Erro ao criar produto: ${error?.message || 'resposta vazia do banco'}` }
  }

  const supabaseAdmin = createAdminClient()
  await supabaseAdmin
    .from('product_private_settings')
    .upsert({
      product_id: product.id,
      webhook_secret: `whsec_${crypto.randomBytes(32).toString('hex')}`,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'product_id' })

  if (data.plans?.length > 0) {
    const plans = data.plans.map((p: any) => ({
      product_id: product.id,
      name: p.name,
      price: parseFloat(p.price) || 0,
      billing_type: 'one_time',
    }))
    const { error: plansError } = await supabase.from('plans').insert(plans)
    if (plansError) {
      console.error('[createProductAction] Plans Error:', plansError)
      return { error: `Produto criado, mas erro ao salvar planos: ${plansError.message}` }
    }
  }

  redirect(`/dashboard/products/${product.id}`)
}

export default async function NewProductPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const access = await getPlatformAccess(user.id)

  return (
    <div className="py-4">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-white">Criar Novo Produto</h1>
        <p className="mt-1 text-sm text-white/50">Configure seu produto, plano e checkout para vender.</p>
      </div>

      {access.allowed ? (
        <div className="rounded-3xl border border-white/10 bg-[#111111] p-8 md:p-12">
          <ProductWizard createProductAction={createProductAction} userId={user.id} />
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-[#111111] p-8 md:p-12">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00e88a]/10 text-[#00e88a]">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black text-white">Assinatura necessaria</h2>
            <p className="mt-2 text-sm text-white/50">
              Para manter a Flowyn sem taxa por venda, a criacao de produtos fica liberada para contas em teste gratis, ativas ou em regularizacao.
            </p>
            <Link href="/dashboard/settings/subscription" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#00e88a] px-5 py-3 text-sm font-black text-black transition hover:bg-[#04f294]">
              <BadgeCheck className="h-4 w-4" />
              Ativar Flowyn Pro
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
