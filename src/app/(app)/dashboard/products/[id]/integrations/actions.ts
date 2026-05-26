'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { dispatchWebhook } from '@/lib/webhook'
import crypto from 'crypto'


export async function testWebhookAction(productId: string, webhookUrl: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Unauthorized' }
  const supabaseAdmin = createAdminClient()

  // Verify ownership
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('owner_id', user.id)
    .single()

  if (!product) return { success: false, error: 'Product not found' }

  const { data: privateSettings } = await supabaseAdmin
    .from('product_private_settings')
    .select('webhook_secret')
    .eq('product_id', productId)
    .single()

  const payload = {
    event: 'purchase.created',
    order_id: 'test_order_' + Date.now(),
    product_id: productId,
    plan_id: 'test_plan_' + Date.now(),
    plan_identifier: 'test_plan',
    customer: {
      name: 'Test Customer',
      email: 'test@example.com'
    },
    amount: 1000,
    commission: {
      rate: 50,
      amount: 500
    },
    affiliate: {
      id: null,
      tracking_id: null
    },
    is_sandbox: true,
    timestamp: new Date().toISOString()
  }

  const body = JSON.stringify(payload)
  const signature = crypto
    .createHmac('sha256', privateSettings?.webhook_secret || '')
    .update(body)
    .digest('hex')

  const startTime = performance.now()
  let responseStatus = null
  let responseBody = ''
  let success = false
  let errorMessage = ''

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5s timeout

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Flowyn-Webhook/1.0',
        'X-Flowyn-Event': 'purchase.created',
        'X-Flowyn-Signature': signature,
        'X-Flowyn-Test': 'true'
      },
      body: body,
      signal: controller.signal
    })

    clearTimeout(timeout)

    responseStatus = res.status
    success = res.ok
    responseBody = await res.text().catch(() => '')
    if (!success) {
      errorMessage = `HTTP ${res.status}: ${res.statusText}`
    }
  } catch (err: any) {
    errorMessage = err.name === 'AbortError' ? 'Request timeout (5s)' : err.message
  }

  const endTime = performance.now()
  const timeMs = Math.round(endTime - startTime)

  // Save the log
  await supabaseAdmin.from('webhook_logs').insert({
    order_id: null, // Test webhook
    product_id: productId,
    webhook_url: webhookUrl,
    request_payload: payload,
    response_status: responseStatus,
    response_body: responseBody.slice(0, 2000),
    success,
    attempt_number: 1,
    error_message: errorMessage || null
  })

  revalidatePath(`/dashboard/products/${productId}/integrations`)

  return {
    success,
    status: responseStatus,
    timeMs,
    body: responseBody,
    error: errorMessage
  }
}

export async function simulatePurchaseAction(productId: string, planId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Unauthorized' }
  const supabaseAdmin = createAdminClient()

  // Verify ownership
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('owner_id', user.id)
    .single()

  if (!product) return { success: false, error: 'Product not found' }

  // Create fake order
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      product_id: productId,
      plan_id: planId,
      customer_name: 'Simulated User',
      customer_email: `test-${Date.now()}@flowyn-sandbox.com`,
      amount: 0,
      commission_rate: 0,
      commission_amount: 0,
      status: 'paid',
      is_sandbox: true
    })
    .select()
    .single()

  if (orderError || !order) {
    console.error('Failed to create simulated order:', orderError)
    return { success: false, error: `Failed to create simulated order: ${orderError?.message || 'Unknown error'}` }
  }

  // Dispatch webhook
  const result = await dispatchWebhook(order.id)
  
  revalidatePath(`/dashboard/products/${productId}/integrations`)
  
  return result
}
