import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe, PLATFORM_FEE_PERCENT, PLATFORM_FEE_FIXED } from '@/lib/stripe'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  console.log('[Checkout] POST request received')
  try {
    const body = await request.json()
    const { plan_id, customer_name, customer_email, affiliate_id, tracking_id, add_order_bump } = body

    if (!plan_id || !customer_name || !customer_email) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: plan_id, customer_name, customer_email' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()

    // 1. Fetch plan + product + owner
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select(`
        *,
        product:products(
          id, name, commission_rate, owner_id, is_flowyn_saas,
          order_bump_title, order_bump_description, order_bump_price, order_bump_discount_percent
        )
      `)
      .eq('id', plan_id)
      .single()

    if (planError || !plan) {
      console.error('[Checkout] Plan fetch failed:', planError)
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

    const product = plan.product as any
    const isFlowynSaas = !!product.is_flowyn_saas

    // For Flowyn SaaS: 75% commission. For others: product's commission_rate.
    const commissionRate = isFlowynSaas ? 75 : Number(product.commission_rate)
    const billingType = plan.billing_type || 'one_time'

    let baseAmount = Number(plan.price)
    let orderBumpAmount = 0
    const includesOrderBump = !!(add_order_bump && product.order_bump_price)
    if (includesOrderBump) {
      const rawPrice = Number(product.order_bump_price)
      const discount = Number(product.order_bump_discount_percent || 0)
      orderBumpAmount = discount > 0 ? rawPrice * (1 - discount / 100) : rawPrice
    }
    const totalAmount = baseAmount + orderBumpAmount
    const totalInCents = Math.round(totalAmount * 100)

    const commissionAmount = affiliate_id ? (totalAmount * commissionRate) / 100 : 0

    // 2. Create pending order
    const orderId = crypto.randomUUID()
    const { error: orderError } = await supabase.from('orders').insert({
      id: orderId,
      product_id: product.id,
      plan_id: plan.id,
      affiliate_id: affiliate_id || null,
      customer_name,
      customer_email,
      amount: totalAmount,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      status: 'pending',
      tracking_id: tracking_id || null,
      includes_order_bump: includesOrderBump,
      order_bump_amount: orderBumpAmount,
    })

    if (orderError) {
      console.error('[Checkout] Order creation failed:', orderError)
      return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 })
    }

    const origin = new URL(request.url).origin

    // 3. Build line items
    const lineItems: any[] = [
      {
        price_data: {
          currency: 'brl',
          product_data: {
            name: `${product.name} — ${plan.name}`,
            metadata: { product_id: product.id, plan_id: plan.id },
          },
          unit_amount: Math.round(baseAmount * 100),
          ...(billingType === 'recurring' ? { recurring: { interval: 'month' } } : {}),
        },
        quantity: 1,
      },
    ]

    // Order bump as second line item
    if (includesOrderBump) {
      lineItems.push({
        price_data: {
          currency: 'brl',
          product_data: { name: product.order_bump_title || 'Oferta Especial' },
          unit_amount: Math.round(orderBumpAmount * 100),
        },
        quantity: 1,
      })
    }

    const sessionMode = billingType === 'recurring' ? 'subscription' : 'payment'

    // 4. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: sessionMode,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/${plan.id}`,
      customer_email: customer_email,
      metadata: {
        order_id: orderId,
        producer_id: product.owner_id,
        affiliate_id: affiliate_id || '',
        commission_rate: commissionRate.toString(),
        tracking_id: tracking_id || '',
        is_flowyn_saas: isFlowynSaas ? 'true' : 'false',
      },
    })

    // 5. Save session ID
    await supabase
      .from('orders')
      .update({ stripe_payment_id: session.id })
      .eq('id', orderId)

    console.log('[Checkout] Stripe session created:', session.id, 'mode:', sessionMode)
    return NextResponse.json({ success: true, order_id: orderId, checkout_url: session.url })

  } catch (err: any) {
    console.error('[Checkout] Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
}
