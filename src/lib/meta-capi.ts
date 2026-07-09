import { createAdminClient } from '@/utils/supabase/admin'

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || ''

export interface CapiOrderData {
  orderId: string
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
  const crypto = require('crypto')
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

  const pixelId = process.env.META_CAPI_PIXEL_ID
  if (!pixelId) {
    console.warn('[Meta CAPI] META_CAPI_PIXEL_ID not configured — skipping')
    return
  }

  const eventId = `purchase_${orderData.orderId}_${Date.now()}`

  const userData: Record<string, unknown> = {
    em: [sha256(orderData.customerEmail)],
    ph: [sha256(orderData.customerPhone)],
    fn: [sha256(orderData.customerName.split(/\s+/)[0] || '')],
    ln: [sha256(orderData.customerName.split(/\s+/).slice(1).join(' ') || '')],
    client_ip_address: orderData.clientIp,
    client_user_agent: orderData.userAgent,
  }

  if (orderData.trackingParams?._fbp) userData.fbp = orderData.trackingParams._fbp
  if (orderData.trackingParams?._fbc) userData.fbc = orderData.trackingParams._fbc

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

  const supabase = createAdminClient()

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