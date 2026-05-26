import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

const ADMIN_EMAIL = 'dnlmarianoneto@gmail.com'
const FLOWYN_COMMISSION = 75 // 75% for affiliates, 25% for Flowyn

function getAdminClient() {
  return createAdminClient()
}

// GET: list all Flowyn SaaS products
export async function GET(request: NextRequest) {
  const supabase = getAdminClient()
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const { data, error: fetchError } = await supabase
    .from('flowyn_saas_products')
    .select('*, product:products(id, name, logo_url, cover_url, commission_rate, created_at, affiliations(id))')
    .order('created_at', { ascending: false })

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  return NextResponse.json({ products: data })
}

// POST: create a new Flowyn SaaS product
export async function POST(request: NextRequest) {
  const supabase = getAdminClient()
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const body = await request.json()
  const {
    name, description, logo_url, cover_url, category,
    price_brl, // monthly price in BRL (e.g. 97)
    checkout_banner_url, checkout_video_url,
  } = body

  if (!name || !price_brl) {
    return NextResponse.json({ error: 'name and price_brl are required' }, { status: 400 })
  }

  try {
    // 1. Get admin profile id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Admin profile not found' }, { status: 404 })

    // 2. Create product in DB. Recurring platform billing will be added later via Asaas.
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        owner_id: profile.id,
        name,
        description: description || null,
        logo_url: logo_url || null,
        cover_url: cover_url || null,
        category: category || 'Software',
        product_type: 'saas',
        is_flowyn_saas: true,
        is_public: true,
        commission_rate: FLOWYN_COMMISSION,
        checkout_banner_url: checkout_banner_url || null,
        checkout_video_url: checkout_video_url || null,
        delivery_type: 'platform',
      })
      .select('id')
      .single()

    if (productError || !product) {
      throw new Error('Failed to create product: ' + productError?.message)
    }

    // 3. Create plan in DB
    const { data: plan } = await supabase
      .from('plans')
      .insert({
        product_id: product.id,
        name: 'Mensal',
        price: Number(price_brl),
        billing_type: 'recurring',
      })
      .select('id')
      .single()

    // 4. Create flowyn_saas_products record
    await supabase.from('flowyn_saas_products').insert({
      product_id: product.id,
      commission_rate: FLOWYN_COMMISSION,
    })

    return NextResponse.json({
      success: true,
      product_id: product.id,
      plan_id: plan?.id,
      message: `SaaS "${name}" criado com preço R$ ${price_brl}/mês e comissão de ${FLOWYN_COMMISSION}% para afiliados.`,
    })

  } catch (err: any) {
    console.error('[Admin SaaS] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
