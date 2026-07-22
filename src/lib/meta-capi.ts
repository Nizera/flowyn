import { createAdminClient } from '@/utils/supabase/admin'
import { decryptApiKey } from '@/lib/encryption'
import crypto from 'crypto'
// CORREÇÃO W5 (auditoria tracking): META_GRAPH_API era hardcoded aqui e em
// meta-graph-api.ts. Agora importamos o GRAPH_API canonico (single source of truth).
import { GRAPH_API } from '@/lib/meta-graph-api'

// Token global META_CAPI_ACCESS_TOKEN mantido APENAS como fallback para pixels
// da própria Flowyn (ambiente dev/teste). Em produção multi-produtor, cada pixel
// deve ter seu próprio capi_access_token (ou um ad_account access_token válido).
const FALLBACK_CAPI_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || ''

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
void sanitize // mantido por compat, não usado atualmente

/**
 * Resolve qual access_token usar para enviar eventos CAPI deste pixel.
 *
 * Prioridade (correção CAPI-per-producer — issue #2/#3 da auditoria tracking):
 * 1. capi_access_token do próprio pixel (campo novo em `pixels.capi_access_token`)
 * 2. access_token do ad_account do produtor (deferred via `getDecryptedToken` from meta-oauth)
 * 3. fallback global META_CAPI_ACCESS_TOKEN (para pixels da própria plataforma)
 *
 * Retorna null se nenhum token estiver configurado — caller deve skipar o envio.
 */
async function resolveCapiAccessToken(
  supabase: ReturnType<typeof createAdminClient>,
  pixelRowId: string,
  producerId: string,
  encryptedPixelCapiToken: string | null
): Promise<string | null> {
  // 1. Token do próprio pixel (mais específico)
  if (encryptedPixelCapiToken) {
    try {
      const decrypted = decryptApiKey(encryptedPixelCapiToken)
      if (decrypted) return decrypted
    } catch (err) {
      console.warn('[Meta CAPI] Falha ao decriptar capi_access_token do pixel:', err)
    }
  }

  // 2. access_token do ad_account do produtor (qualquer conta ativa dele)
  try {
    const { getDecryptedToken } = await import('@/lib/meta-oauth')
    // getDecryptedToken espera (adAccountId, userId). Não sabemos qual ad_account
    // está vinculada a este pixel, então buscamos a primeira conta ativa do produtor.
    const { data: adAccount } = await supabase
      .from('ad_accounts')
      .select('ad_account_id')
      .eq('user_id', producerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (adAccount?.ad_account_id) {
      const token = await getDecryptedToken(adAccount.ad_account_id, producerId)
      if (token) return token
    }
  } catch (err) {
    console.warn('[Meta CAPI] Falha ao buscar ad_account access_token do produtor:', err)
  }

  // 3. Fallback global
  if (FALLBACK_CAPI_TOKEN) return FALLBACK_CAPI_TOKEN

  return null
}

export async function sendCapiEvent(orderData: CapiOrderData) {
  const supabase = createAdminClient()

  const { data: planPixel } = await supabase
    .from('plan_pixels')
    .select('pixel:pixels(id, pixel_id, platform, is_active, capi_access_token)')
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

  // CORREÇÃO issue #2/#3 (auditoria tracking): usa token do próprio pixel,
  // fallback token do ad_account do produtor, fallback token global.
  const accessToken = await resolveCapiAccessToken(
    supabase,
    pixelRow.id,
    orderData.producerId,
    pixelRow.capi_access_token
  )

  if (!accessToken) {
    console.warn('[Meta CAPI] Nenhum access token disponível para o pixel — skipping. Configure capi_access_token no painel Pixels, conecte uma conta Meta Ads, ou defina META_CAPI_ACCESS_TOKEN global.')
    await supabase.from('tracking_events').insert({
      order_id: orderData.orderId,
      product_id: orderData.productId,
      producer_id: orderData.producerId,
      platform: 'meta',
      event_name: 'Purchase',
      event_id: `order_${orderData.orderId}`,
      status: 'skipped',
      error_message: 'No CAPI access token available (pixel.capi_access_token empty, producer has no active ad_account, and no global fallback).',
    })
    return
  }

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

  const customData: Record<string, unknown> = {
    value: orderData.amount,
    currency: 'BRL',
    order_id: orderData.orderId,
    content_type: 'product',
  }

  // Enviar UTMs no custom_data para matching avançado no Meta
  // (Meta usa click IDs como matching primário, mas UTMs ajudam em
  // cenários onde click IDs não estão disponíveis)
  if (orderData.trackingParams) {
    const tp = orderData.trackingParams
    if (tp.utm_source) customData.utm_source = tp.utm_source
    if (tp.utm_medium) customData.utm_medium = tp.utm_medium
    if (tp.utm_campaign) customData.utm_campaign = tp.utm_campaign
    if (tp.utm_content) customData.utm_content = tp.utm_content
    if (tp.utm_term) customData.utm_term = tp.utm_term
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
        custom_data: customData,
      },
    ],
    access_token: accessToken,
  }

  try {
    const response = await fetch(`${GRAPH_API}/${pixelId}/events`, {
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
