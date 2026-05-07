import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dispatchWebhook } from '@/lib/webhook'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  try {
    // Verify Asaas Webhook Token
    const authToken = request.headers.get('asaas-access-token')
    if (authToken !== process.env.ASAAS_WEBHOOK_TOKEN) {
      console.warn('[Asaas Webhook] Unauthorized attempt with token:', authToken)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { event, payment } = body

    console.log(`[Asaas Webhook] Event: ${event} Payment ID: ${payment?.id}`)

    // Handle different payment events
    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED': {
        await handlePaymentSuccess(payment)
        break
      }
      case 'PAYMENT_REFUNDED': {
        await handlePaymentRefunded(payment)
        break
      }
      default:
        console.log(`[Asaas Webhook] Unhandled event: ${event}`)
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('[Asaas Webhook] Error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

async function handlePaymentSuccess(payment: any) {
  const orderId = payment.externalReference
  if (!orderId) {
    console.error('[Asaas Webhook] No externalReference (order_id) found in payment')
    return
  }

  // Fetch the order
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('*, product:products(id, name, webhook_url, owner_id, site_url)')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    console.error('[Asaas Webhook] Order not found:', orderId, orderError)
    return
  }

  // 1. Mark order as paid
  await supabaseAdmin
    .from('orders')
    .update({
      status: 'paid',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  // 2. Provision customer account on Flowyn
  try {
    await provisionCustomer(order)
  } catch (err) {
    console.error('[Asaas Webhook] Customer provisioning error:', err)
  }

  // 3. Dispatch webhook to producer's SaaS
  try {
    await dispatchWebhook(orderId)
  } catch (err) {
    console.error('[Asaas Webhook] Webhook dispatch error:', err)
  }
}

async function handlePaymentRefunded(payment: any) {
  const orderId = payment.externalReference
  if (!orderId) return

  await supabaseAdmin
    .from('orders')
    .update({ status: 'refunded' })
    .eq('id', orderId)
}

async function provisionCustomer(order: any) {
  // Logic for provisioning customer account
  const email = order.customer_email
  const name = order.customer_name
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectTo = `${baseUrl}/accept-invite?order_id=${order.id}`

  // Check if user already exists
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find(u => u.email === email)

  let userId: string

  if (existingUser) {
    userId = existingUser.id
  } else {
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: name, role: 'customer' },
    })

    if (inviteError || !inviteData?.user) return
    userId = inviteData.user.id

    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      role: 'customer',
      full_name: name,
    }, { onConflict: 'id' })
  }

  await supabaseAdmin
    .from('orders')
    .update({ customer_user_id: userId, customer_provisioned: true })
    .eq('id', order.id)
}
