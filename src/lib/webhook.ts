import crypto from 'crypto'
import { createAdminClient } from '@/utils/supabase/admin'

const supabaseAdmin = createAdminClient()

interface WebhookPayload {
  event: string
  order_id: string
  product_id: string
  plan_id: string
  customer: {
    name: string
    email: string
  }
  amount: number
  commission: {
    rate: number
    amount: number
  }
  affiliate: {
    id: string | null
    tracking_id: string | null
  }
  is_sandbox: boolean
  timestamp: string
  // Campos em PT-BR para Make.com
  email?: string
  nome?: string
  id_do_pedido?: string
  id_do_produto?: string
  id_do_plano?: string
}

const MAX_RETRIES = 3
const RETRY_DELAYS = [5000, 30000, 300000] // 5s, 30s, 5min

/**
 * Dispatch a webhook notification to the producer's SaaS endpoint
 * with automatic retry logic and logging.
 */
export async function dispatchWebhook(orderId: string): Promise<{ success: boolean; error?: string }> {
  // Fetch the order with product and webhook URL
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('*, product:products(id, name, webhook_url, owner_id), plan:plans(name, plan_identifier)')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    console.error('[Webhook] Order not found:', orderId, orderError)
    return { success: false, error: 'Order not found' }
  }

  const product = order.product as any
  const plan = order.plan as any
  const webhookUrl = product?.webhook_url

  if (!webhookUrl) {
    // No webhook configured — not an error, just skip
    await supabaseAdmin
      .from('orders')
      .update({ webhook_status: 'skipped' })
      .eq('id', orderId)
    return { success: true }
  }

  const payload: WebhookPayload & { plan_identifier?: string } = {
    event: 'purchase.created',
    order_id: orderId,
    product_id: product.id,
    plan_id: order.plan_id,
    plan_identifier: plan?.plan_identifier || undefined,
    customer: {
      name: order.customer_name,
      email: order.customer_email,
    },
    amount: Number(order.amount),
    commission: {
      rate: Number(order.commission_rate),
      amount: Number(order.commission_amount),
    },
    affiliate: {
      id: order.affiliate_id,
      tracking_id: order.tracking_id,
    },
    is_sandbox: order.status === 'test' || order.id.startsWith('test_'),
    timestamp: new Date().toISOString(),
    
    // Campos em PT-BR exigidos para a Make.com
    email: order.customer_email,
    nome: order.customer_name,
    id_do_pedido: orderId,
    id_do_produto: product.id,
    id_do_plano: order.plan_id,
  }

  const { data: privateSettings } = await supabaseAdmin
    .from('product_private_settings')
    .select('webhook_secret')
    .eq('product_id', product.id)
    .single()

  const body = JSON.stringify(payload)
  const secret = privateSettings?.webhook_secret || 'wh_sec_missing'
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  // Attempt delivery with retries
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Flowyn-Webhook/1.0',
          'X-Flowyn-Event': 'purchase.created',
          'X-Flowyn-Signature': signature,
          'X-Flowyn-Delivery': orderId,
          'X-Flowyn-Attempt': String(attempt),
        },
        body: body,
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const responseBody = await response.text().catch(() => '')

      // Log the attempt
      await supabaseAdmin.from('webhook_logs').insert({
        order_id: orderId,
        product_id: product.id,
        webhook_url: webhookUrl,
        request_payload: payload,
        response_status: response.status,
        response_body: responseBody.slice(0, 2000), // Limit stored response
        success: response.ok,
        attempt_number: attempt,
        error_message: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
      })

      if (response.ok) {
        // Success! Update order webhook status
        await supabaseAdmin
          .from('orders')
          .update({ webhook_status: 'delivered', webhook_attempts: attempt })
          .eq('id', orderId)

        console.log(`[Webhook] ✅ Delivered for order ${orderId} on attempt ${attempt}. Status: ${response.status} - Body: ${responseBody.slice(0, 300)}`)
        return { success: true }
      }

      console.warn(`[Webhook] ⚠️ Attempt ${attempt}/${MAX_RETRIES} failed for order ${orderId}: HTTP ${response.status} - Response: ${responseBody.slice(0, 300)}`)

    } catch (err: any) {
      const errorMessage = err.name === 'AbortError' ? 'Request timeout (10s)' : err.message

      // Log the failed attempt
      await supabaseAdmin.from('webhook_logs').insert({
        order_id: orderId,
        product_id: product.id,
        webhook_url: webhookUrl,
        request_payload: payload,
        response_status: null,
        response_body: null,
        success: false,
        attempt_number: attempt,
        error_message: errorMessage,
      })

      console.warn(`[Webhook] ⚠️ Attempt ${attempt}/${MAX_RETRIES} error for order ${orderId}: ${errorMessage}`)
    }

    // Wait before retrying (but not after the last attempt)
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS[attempt - 1] || 5000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // All retries exhausted
  await supabaseAdmin
    .from('orders')
    .update({ webhook_status: 'failed', webhook_attempts: MAX_RETRIES })
    .eq('id', orderId)

  console.error(`[Webhook] ❌ All ${MAX_RETRIES} attempts failed for order ${orderId}`)
  return { success: false, error: `All ${MAX_RETRIES} delivery attempts failed` }
}

/**
 * Retry a specific failed webhook delivery
 */
export async function retryWebhook(orderId: string): Promise<{ success: boolean; error?: string }> {
  // Reset status and re-dispatch
  await supabaseAdmin
    .from('orders')
    .update({ webhook_status: 'pending', webhook_attempts: 0 })
    .eq('id', orderId)

  return dispatchWebhook(orderId)
}
