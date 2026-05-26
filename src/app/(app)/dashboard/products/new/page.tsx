import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { ProductWizard } from './ProductWizard'
import crypto from 'crypto'

const ADMIN_EMAIL = 'dnlmarianoneto@gmail.com'

// ─── Server Action: Create Product ───────────────────────────────────────────
async function createProductAction(data: any): Promise<{ error: string } | void> {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Block SaaS/MicroSaaS creation for non-admin users
  const isAdmin = user.email === ADMIN_EMAIL
  if (!isAdmin && (data.product_type === 'saas' || data.product_type === 'microsaas' || data.is_flowyn_saas)) {
    return { error: 'Apenas administradores da Flowyn podem criar produtos SaaS.' }
  }

  // 1. Create product
  const { data: product, error } = await supabase
    .from('products')
    .insert({
      owner_id: user.id,
      name: data.name,
      description: data.description,
      short_description: data.short_description || null,
      logo_url: data.logo_url || null,
      cover_url: data.cover_url || null,
      site_url: data.site_url || null,
      category: data.category,
      product_type: data.product_type,
      is_public: data.is_public,
      is_flowyn_saas: false,
      commission_rate: parseFloat(data.commission_rate) || 40,
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

  // 2. Create plans
  if (data.plans?.length > 0) {
    const plans = data.plans.map((p: any) => ({
      product_id: product.id,
      name: p.name,
      price: parseFloat(p.price) || 0,
      billing_type: p.billing_type || 'one_time',
    }))
    const { error: plansError } = await supabase.from('plans').insert(plans)
    if (plansError) {
      console.error('[createProductAction] Plans Error:', plansError)
      return { error: `Produto criado, mas erro ao salvar planos: ${plansError.message}` }
    }
  }

  redirect(`/dashboard/products/${product.id}`)
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function NewProductPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="py-4">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-white">Criar Novo Produto</h1>
        <p className="text-white/50 text-sm mt-1">
          Siga as etapas abaixo para configurar e publicar seu produto.
        </p>
      </div>

      <div className="bg-[#111111] border border-white/10 rounded-3xl p-8 md:p-12">
        <ProductWizard createProductAction={createProductAction} userId={user.id} />
      </div>
    </div>
  )
}
