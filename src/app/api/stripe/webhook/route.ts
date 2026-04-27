import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLATFORM_FEE_PERCENT } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { dispatchWebhook } from '@/lib/webhook'
import Stripe from 'stripe'

// Admin client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  let event: Stripe.Event

  try {
    // If webhook secret is configured, verify signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    console.log('[Stripe Webhook] Secret configured:', !!webhookSecret)
    
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } else {
      console.warn('[Stripe Webhook] No secret or signature found, using unverified parse')
      event = JSON.parse(body) as Stripe.Event
    }
  } catch (err: any) {
    console.error('[Stripe Webhook] Verification failed:', err.message)
    return NextResponse.json({ 
      error: 'Invalid signature', 
      details: err.message,
      received_sig: !!sig,
      has_secret: !!process.env.STRIPE_WEBHOOK_SECRET
    }, { status: 400 })
  }

  console.log(`[Stripe Webhook] Processing event: ${event.id} type: ${event.type}`)

  switch (event.type) {
    case 'checkout.session.completed': {
      await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session)
      break
    }
    case 'checkout.session.expired': {
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session)
      break
    }
    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id
  if (!orderId) {
    console.error('[Stripe Webhook] No order_id in session metadata')
    return
  }

  // Fetch the order (include site_url for post-activation redirect)
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('*, product:products(id, name, webhook_url, owner_id, site_url)')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    console.error('[Stripe Webhook] Order not found:', orderId, orderError)
    return
  }

  const product = order.product as any
  const amountInCents = session.amount_total || 0
  const paymentIntentId = session.payment_intent as string

  // 1. Mark order as paid
  await supabaseAdmin
    .from('orders')
    .update({
      status: 'paid',
      stripe_payment_intent_id: paymentIntentId,
      stripe_session_id: session.id,
    })
    .eq('id', orderId)

  // 2. Create transfers (splits)
  try {
    // Get the charge ID from the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    const chargeId = paymentIntent.latest_charge as string

    // Get producer's Stripe account
    const { data: producerProfile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, stripe_onboarding_complete')
      .eq('id', product.owner_id)
      .single()

    const commissionRate = Number(order.commission_rate) || 0
    const platformFeePercent = PLATFORM_FEE_PERCENT

    // Calculate amounts (in centavos)
    const affiliateAmount = Math.round(amountInCents * (commissionRate / 100))
    const platformFee = Math.round(amountInCents * (platformFeePercent / 100))
    const producerAmount = amountInCents - affiliateAmount - platformFee

    // Transfer to producer
    if (producerProfile?.stripe_account_id && producerProfile.stripe_onboarding_complete && producerAmount > 0) {
      await stripe.transfers.create({
        amount: producerAmount,
        currency: 'brl',
        destination: producerProfile.stripe_account_id,
        transfer_group: `order_${orderId}`,
        source_transaction: chargeId,
        metadata: {
          order_id: orderId,
          type: 'producer_payment',
        },
      })
      console.log(`[Stripe Webhook] ✅ Producer transfer: R$ ${(producerAmount / 100).toFixed(2)} -> ${producerProfile.stripe_account_id}`)
    } else {
      console.warn(`[Stripe Webhook] ⚠️ Producer ${product.owner_id} has no connected Stripe account, transfer skipped`)
    }

    // Transfer to affiliate (if exists)
    if (order.affiliate_id && affiliateAmount > 0) {
      const { data: affiliateProfile } = await supabaseAdmin
        .from('profiles')
        .select('stripe_account_id, stripe_onboarding_complete')
        .eq('id', order.affiliate_id)
        .single()

      if (affiliateProfile?.stripe_account_id && affiliateProfile.stripe_onboarding_complete) {
        await stripe.transfers.create({
          amount: affiliateAmount,
          currency: 'brl',
          destination: affiliateProfile.stripe_account_id,
          transfer_group: `order_${orderId}`,
          source_transaction: chargeId,
          metadata: {
            order_id: orderId,
            type: 'affiliate_commission',
          },
        })
        console.log(`[Stripe Webhook] ✅ Affiliate transfer: R$ ${(affiliateAmount / 100).toFixed(2)} -> ${affiliateProfile.stripe_account_id}`)
      } else {
        console.warn(`[Stripe Webhook] ⚠️ Affiliate ${order.affiliate_id} has no connected Stripe account, commission transfer skipped`)
      }
    }

    // Update order with split info
    await supabaseAdmin
      .from('orders')
      .update({
        platform_fee: platformFee / 100,
        producer_amount: producerAmount / 100,
      })
      .eq('id', orderId)

    console.log(`[Stripe Webhook] ✅ Payment split complete for order ${orderId}`)
    console.log(`  Total: R$ ${(amountInCents / 100).toFixed(2)} | Producer: R$ ${(producerAmount / 100).toFixed(2)} | Affiliate: R$ ${(affiliateAmount / 100).toFixed(2)} | Platform: R$ ${(platformFee / 100).toFixed(2)}`)

  } catch (transferErr: any) {
    console.error('[Stripe Webhook] Transfer error:', transferErr)
    // Order is still marked as paid, transfers can be retried
    await supabaseAdmin
      .from('orders')
      .update({ transfer_status: 'failed' })
      .eq('id', orderId)
  }

  // 3. Provision customer account on Flowyn
  provisionCustomer(order).catch(err => {
    console.error('[Stripe Webhook] Customer provisioning error:', err)
  })

  // 4. Dispatch webhook to producer's SaaS
  dispatchWebhook(orderId).catch(err => {
    console.error('[Stripe Webhook] Webhook dispatch error:', err)
  })
}

async function provisionCustomer(order: any) {
  // Skip if already provisioned
  if (order.customer_provisioned) {
    console.log(`[Provision] Customer already provisioned for order ${order.id}`)
    return
  }

  const email = order.customer_email
  const name = order.customer_name
  const product = order.product
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectTo = `${baseUrl}/accept-invite?order_id=${order.id}`

  try {
    // Check if user already exists on Flowyn
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    let userId: string

    if (existingUser) {
      // User already has a Flowyn account — just link the order
      userId = existingUser.id
      console.log(`[Provision] Existing Flowyn user found: ${userId}`)
    } else {
      // Create new Flowyn account via invite (sends activation email automatically)
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { full_name: name, role: 'customer' },
      })

      if (inviteError || !inviteData?.user) {
        console.error('[Provision] Failed to invite user:', inviteError)
        return
      }

      userId = inviteData.user.id

      // Ensure profile row exists for the new customer
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        role: 'customer',
        full_name: name,
      }, { onConflict: 'id' })

      console.log(`[Provision] ✅ New customer invited: ${email} (${userId})`)
    }

    // Link order to customer user
    await supabaseAdmin
      .from('orders')
      .update({ customer_user_id: userId, customer_provisioned: true })
      .eq('id', order.id)

    console.log(`[Provision] ✅ Order ${order.id} linked to customer ${userId}`)

  } catch (err) {
    console.error('[Provision] Unexpected error:', err)
  }
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id
  if (!orderId) return

  await supabaseAdmin
    .from('orders')
    .update({ status: 'expired' })
    .eq('id', orderId)

  console.log(`[Stripe Webhook] Checkout expired for order ${orderId}`)
}
