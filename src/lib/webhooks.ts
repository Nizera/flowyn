import { createAdminClient } from '@/utils/supabase/admin'
import crypto from 'crypto'

export type WebhookEvent =
  | 'subscription.created'
  | 'subscription.renewed'
  | 'subscription.canceled'
  | 'subscription.payment_failed'
  | 'subscription.trial_ending'
  | 'payment.confirmed'
  | 'payment.failed'
  | 'payment.refunded'

interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
}

interface WebhookConfig {
  id: string
  url: string
  secret: string
  events: WebhookEvent[]
  is_active: boolean
}

const MAX_ATTEMPTS = 5
const RETRY_DELAYS_MS = [
  0,           // immediate
  60_000,      // 1 minute
  5 * 60_000,  // 5 minutes
  30 * 60_000, // 30 minutes
  60 * 60_000, // 1 hour
]

const BLOCKED_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^localhost$/i,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
]

export function isUrlSafe(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    if (url.protocol !== 'https:') return false
    const hostname = url.hostname
    if (BLOCKED_IP_RANGES.some(re => re.test(hostname))) return false
    if (hostname === '169.254.169.254') return false
    return true
  } catch {
    return false
  }
}

function signPayload(payload: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function getRetryDelay(attempt: number): number {
  return RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]
}

export async function sendWebhook(
  producerId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient()

  const { data: webhooks, error } = await admin
    .from('producer_webhooks')
    .select('id, url, secret, events, is_active')
    .eq('producer_id', producerId)
    .eq('is_active', true)

  if (error || !webhooks?.length) {
    console.log(`[Webhook] No active webhooks for producer ${producerId}`)
    return { sent: 0, failed: 0 }
  }

  const matching = webhooks.filter((w: WebhookConfig) => w.events.includes(event))

  if (!matching.length) {
    console.log(`[Webhook] No webhooks subscribed to event ${event}`)
    return { sent: 0, failed: 0 }
  }

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  }

  const bodyStr = JSON.stringify(payload)

  let sent = 0
  let failed = 0

  for (const webhook of matching) {
    try {
      const signature = signPayload(bodyStr, webhook.secret)

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Flowyn-Signature': signature,
          'X-Flowyn-Event': event,
          'User-Agent': 'Flowyn-Webhook/1.0',
        },
        body: bodyStr,
        signal: AbortSignal.timeout(10_000),
      })

      const responseBody = await response.text().catch(() => '')

      await admin.from('webhook_deliveries').insert({
        webhook_id: webhook.id,
        event,
        payload,
        response_status: response.status,
        response_body: responseBody.substring(0, 1000),
        success: response.ok,
        attempt_count: 0,
        next_retry_at: response.ok ? null : new Date(Date.now() + getRetryDelay(0)).toISOString(),
        completed_at: response.ok ? new Date().toISOString() : null,
      })

      await admin
        .from('producer_webhooks')
        .update({
          last_triggered_at: new Date().toISOString(),
          last_response_status: response.status,
        })
        .eq('id', webhook.id)

      if (response.ok) {
        sent++
      } else {
        failed++
      }
    } catch (err) {
      console.error(`[Webhook] Failed to send to ${webhook.url}:`, err)

      await admin.from('webhook_deliveries').insert({
        webhook_id: webhook.id,
        event,
        payload,
        success: false,
        error_message: err instanceof Error ? err.message : 'Unknown error',
        attempt_count: 0,
        next_retry_at: new Date(Date.now() + getRetryDelay(0)).toISOString(),
      })

      failed++
    }
  }

  console.log(`[Webhook] Event ${event}: ${sent} sent, ${failed} failed`)
  return { sent, failed }
}

export async function retryPendingWebhooks(): Promise<{ retried: number; succeeded: number }> {
  const admin = createAdminClient()

  const now = new Date().toISOString()

  const { data: pending, error } = await admin
    .from('webhook_deliveries')
    .select('id, webhook_id, event, payload, attempt_count, max_attempts')
    .lte('next_retry_at', now)
    .eq('success', false)
    .lt('attempt_count', MAX_ATTEMPTS)
    .limit(50)

  if (error || !pending?.length) {
    return { retried: 0, succeeded: 0 }
  }

  const webhookIds = [...new Set(pending.map((d: { webhook_id: string }) => d.webhook_id))]
  const { data: webhooks } = await admin
    .from('producer_webhooks')
    .select('id, url, secret, is_active')
    .in('id', webhookIds)

  const webhookMap = new Map((webhooks || []).map((w: Record<string, unknown>) => [w.id, w]))

  let retried = 0
  let succeeded = 0

  for (const delivery of pending) {
    const webhook = webhookMap.get(delivery.webhook_id) as { url: string; secret: string; is_active: boolean } | undefined
    if (!webhook || !webhook.is_active) continue

    retried++

    try {
      const body = JSON.stringify(delivery.payload)
      const signature = signPayload(body, webhook.secret)

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Flowyn-Signature': signature,
          'X-Flowyn-Event': delivery.event,
          'User-Agent': 'Flowyn-Webhook/1.0',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      })

      const responseBody = await response.text().catch(() => '')
      const nextAttempt = delivery.attempt_count + 1

      await admin
        .from('webhook_deliveries')
        .update({
          response_status: response.status,
          response_body: responseBody.substring(0, 1000),
          success: response.ok,
          attempt_count: nextAttempt,
          next_retry_at: response.ok ? null : new Date(Date.now() + getRetryDelay(nextAttempt)).toISOString(),
          completed_at: response.ok ? new Date().toISOString() : null,
          error_message: response.ok ? null : `HTTP ${response.status}`,
        })
        .eq('id', delivery.id)

      if (response.ok) succeeded++
    } catch (err) {
      const nextAttempt = delivery.attempt_count + 1

      await admin
        .from('webhook_deliveries')
        .update({
          attempt_count: nextAttempt,
          next_retry_at: new Date(Date.now() + getRetryDelay(nextAttempt)).toISOString(),
          error_message: err instanceof Error ? err.message : 'Unknown error',
        })
        .eq('id', delivery.id)
    }
  }

  return { retried, succeeded }
}

export async function getWebhookStats(producerId: string) {
  const admin = createAdminClient()

  const { data: webhooks } = await admin
    .from('producer_webhooks')
    .select('id, url, events, is_active, last_triggered_at, last_response_status')
    .eq('producer_id', producerId)

  if (!webhooks?.length) return { webhooks: [], deliveries: [] }

  const webhookIds = webhooks.map((w: { id: string }) => w.id)

  const { data: deliveries } = await admin
    .from('webhook_deliveries')
    .select('id, webhook_id, event, success, response_status, attempt_count, created_at')
    .in('webhook_id', webhookIds)
    .order('created_at', { ascending: false })
    .limit(100)

  const statsMap = new Map<string, { total: number; success: number }>()
  for (const d of (deliveries || []) as { webhook_id: string; success: boolean }[]) {
    const existing = statsMap.get(d.webhook_id) || { total: 0, success: 0 }
    existing.total++
    if (d.success) existing.success++
    statsMap.set(d.webhook_id, existing)
  }

  return {
    webhooks: webhooks.map((w: Record<string, unknown>) => ({
      ...w,
      delivery_count: statsMap.get(w.id as string)?.total || 0,
      success_count: statsMap.get(w.id as string)?.success || 0,
    })),
    deliveries: deliveries || [],
  }
}
