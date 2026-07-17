import { createAdminClient } from '@/utils/supabase/admin'
import { decryptApiKey } from '@/lib/encryption'
import crypto from 'crypto'

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || ''

export interface CapiOrderData {
  orderId: string
  planId: string
  productId: string
  producerId: string
  amount: number
  customerEmail: string
  customerPhone: string
  customerName: string
  customerDocument: string
  clientIp: string
  userAgent: string
  eventSourceUrl: string
  trackingParams?: Record<string, string> | null
}

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex')
}

function sanitize(value: string): string {
  return value.toLowerCase().trim()
}

export async function sendCapiEvent(orderData: CapiOrderData) {
  if (!ACCESS_TOKEN) {
    console.warn('[Meta CAPI] META_CAPI_ACCESS_TOKEN not configured — skipping')
    return
  }

  const supabase = createAdminClient()

  const { data: planPixel } = await supabase
    .from('plan_pixels')
    .select('pixel:pixels(pixel_id, platform, is_active)')
    .eq('plan_id', orderData.planId)
    .maybeSingle()

  const pixelRow = (() => {
    const raw = planPixel?.pixel
    if (!raw) return null
    return Array.isArray(raw) ? raw[0] : raw
  })()
  if (!pixelRow?.is_active || pixelRow.platform !== 'meta') {
    console.warn('[Meta CAPI] No active Meta pixel linked to this plan — skipping')
    return
  }

  const pixelId = decryptApiKey(pixelRow.pixel_id)

  const eventId = `order_${orderData.orderId}`

  const userData: Record<string, unknown> = {
    em: [sha256(orderData.customerEmail)],
    ph: [sha256(orderData.customerPhone)],
    fn: [sha256(orderData.customerName.split(/\s+/)[0] || '')],
    ln: [sha256(orderData.customerName.split(/\s+/).slice(1).join(' ') || '')],
    client_ip_address: orderData.clientIp,
    client_user_agent: orderData.userAgent,
  }

  if (orderData.trackingParams?._fbp) userData.fbp = orderData.trackingParams._fbp
  if (orderData.trackingParams?._fbc) {
    userData.fbc = orderData.trackingParams._fbc
  } else if (orderData.trackingParams?.fbclid) {
    const ts = Math.floor(Date.now() / 1000)
    userData.fbc = `fb.1.${ts}.${orderData.trackingParams.fbclid}`
  }

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: orderData.eventSourceUrl,
        user_data: userData,
        custom_data: {
          value: orderData.amount,
          currency: 'BRL',
          order_id: orderData.orderId,
          content_type: 'product',
        },
      },
    ],
    access_token: ACCESS_TOKEN,
  }

  try {
    const response = await fetch(`${META_GRAPH_API}/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    const ok = Boolean(result.events_received)
    await supabase.from('tracking_events').insert({
      order_id: orderData.orderId,
      product_id: orderData.productId,
      producer_id: orderData.producerId,
      platform: 'meta',
      event_name: 'Purchase',
      event_id: eventId,
      status: ok ? 'sent' : 'failed',
      response: result,
      error_message: !ok ? (result.error?.message ?? JSON.stringify(result)) : null,
    })

    if (!ok) {
      console.error('[Meta CAPI] Send failed:', result)
    }

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await supabase.from('tracking_events').insert({
      order_id: orderData.orderId,
      product_id: orderData.productId,
      producer_id: orderData.producerId,
      platform: 'meta',
      event_name: 'Purchase',
      event_id: eventId,
      status: 'failed',
      error_message: message.slice(0, 500),
    })
    console.error('[Meta CAPI] Send error:', message)
    return null
  }
}