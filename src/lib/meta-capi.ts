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

// Eventos suportados pela Meta Conversions API
export type CapiEventName = 'PageView' | 'ViewContent' | 'InitiateCheckout' | 'Purchase'

// Dados base para qualquer evento CAPI
export interface CapiEventData {
  eventId: string                    // ID do evento para dedup com pixel client-side
  eventName: CapiEventName
  pixelId?: string                   // Opcional: override do pixel (senão resolve via plan_id)
  planId?: string                    // Usado para resolver pixel via plan_pixels
  productId?: string
  producerId: string
  clientIp: string
  userAgent: string
  eventSourceUrl: string
  trackingParams?: Record<string, string> | null
}

// Dados específicos do evento Purchase (extende o base)
export interface CapiOrderData extends CapiEventData {
  eventName: 'Purchase'
  orderId: string
  amount: number
  customerEmail: string
  customerPhone: string
  customerName: string
  customerDocument: string
}

// Dados para eventos de funil (PageView, ViewContent, InitiateCheckout)
export interface CapiFunnelData extends CapiEventData {
  eventName: 'PageView' | 'ViewContent' | 'InitiateCheckout'
  customerEmail?: string
  customerPhone?: string
  customerName?: string
}

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex')
}

function normalizePhone(phone?: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 8 ? digits : ''
}

function normalizeName(name?: string | null): string {
  if (!name) return ''
  return name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s]/g, '')
}

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

/**
 * Resolve o pixel_id e configuração a partir de plan_id ou pixel_id direto.
 */
async function resolvePixel(
  supabase: ReturnType<typeof createAdminClient>,
  planId?: string,
  pixelIdOverride?: string
) {
  // Se pixelId foi passado diretamente, usa ele
  if (pixelIdOverride) {
    const { data: pixel } = await supabase
      .from('pixels')
      .select('id, pixel_id, platform, is_active, capi_access_token')
      .eq('id', pixelIdOverride)
      .maybeSingle()

    if (pixel?.is_active && pixel.platform === 'meta') {
      return pixel
    }
  }

  // Resolve via plan_pixels
  if (planId) {
    const { data: planPixel } = await supabase
      .from('plan_pixels')
      .select('pixel:pixels(id, pixel_id, platform, is_active, capi_access_token)')
      .eq('plan_id', planId)
      .maybeSingle()

    const pixelRow = (() => {
      const raw = planPixel?.pixel
      if (!raw) return null
      return Array.isArray(raw) ? raw[0] : raw
    })()

    if (pixelRow?.is_active && pixelRow.platform === 'meta') {
      return pixelRow
    }
  }

  return null
}

/**
 * Envia um evento CAPI para a Meta.
 * Suporta PageView, ViewContent, InitiateCheckout e Purchase.
 *
 * Para Purchase, mantém compatibilidade com a interface CapiOrderData existente.
 * Para eventos de funil, usa CapiFunnelData.
 */
export async function sendCapiEvent(data: CapiOrderData | CapiFunnelData) {
  const supabase = createAdminClient()

  const pixelRow = await resolvePixel(supabase, data.planId, data.pixelId)

  if (!pixelRow) {
    console.warn(`[Meta CAPI] No active Meta pixel linked to this event — skipping`)
    return
  }

  const pixelId = decryptApiKey(pixelRow.pixel_id)

  const accessToken = await resolveCapiAccessToken(
    supabase,
    pixelRow.id,
    data.producerId,
    pixelRow.capi_access_token
  )

  if (!accessToken) {
    console.warn('[Meta CAPI] Nenhum access token disponível para o pixel — skipping')
    await logTrackingEvent(supabase, data, 'skipped', 'No CAPI access token available')
    return
  }

  // Monta user_data (PII hash) — Advanced Matching para todos os eventos
  const userData: Record<string, unknown> = {
    client_ip_address: data.clientIp,
    client_user_agent: data.userAgent,
  }

  // Extrair dados do cliente (Purchase ou funnel com dados opcionais)
  let customerEmail = ''
  let customerPhone = ''
  let customerName = ''

  if (data.eventName === 'Purchase' && 'customerEmail' in data) {
    const purchaseData = data as CapiOrderData
    customerEmail = purchaseData.customerEmail || ''
    customerPhone = purchaseData.customerPhone || ''
    customerName = purchaseData.customerName || ''
  } else if ('customerEmail' in data) {
    const funnelData = data as CapiFunnelData
    customerEmail = funnelData.customerEmail || ''
    customerPhone = funnelData.customerPhone || ''
    customerName = funnelData.customerName || ''
  }

  // Advanced Matching: incluir PII em TODOS os eventos quando disponível
  if (customerEmail) userData.em = [sha256(customerEmail)]
  const cleanPhone = normalizePhone(customerPhone)
  if (cleanPhone) userData.ph = [sha256(cleanPhone)]
  const cleanName = normalizeName(customerName)
  if (cleanName) {
    const nameParts = cleanName.split(/\s+/)
    if (nameParts[0]) userData.fn = [sha256(nameParts[0])]
    if (nameParts.slice(1).join(' ')) userData.ln = [sha256(nameParts.slice(1).join(' '))]
  }

  // fbp/fbc para matching
  if (data.trackingParams?._fbp) userData.fbp = data.trackingParams._fbp
  if (data.trackingParams?._fbc) {
    userData.fbc = data.trackingParams._fbc
  }

  // Monta custom_data
  const customData: Record<string, unknown> = {}

  // Purchase tem dados monetários
  if (data.eventName === 'Purchase' && 'amount' in data) {
    const purchaseData = data as CapiOrderData
    customData.value = purchaseData.amount
    customData.currency = 'BRL'
    customData.order_id = purchaseData.orderId
    customData.content_type = 'product'
  }

  // UTMs para matching avançado
  if (data.trackingParams) {
    const tp = data.trackingParams
    if (tp.utm_source) customData.utm_source = tp.utm_source
    if (tp.utm_medium) customData.utm_medium = tp.utm_medium
    if (tp.utm_campaign) customData.utm_campaign = tp.utm_campaign
    if (tp.utm_content) customData.utm_content = tp.utm_content
    if (tp.utm_term) customData.utm_term = tp.utm_term
  }

  const payload = {
    data: [
      {
        event_name: data.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: data.eventId,
        action_source: 'website',
        event_source_url: data.eventSourceUrl,
        user_data: userData,
        custom_data: Object.keys(customData).length > 0 ? customData : undefined,
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

    await logTrackingEvent(supabase, data, ok ? 'sent' : 'failed', ok ? null : (result.error?.message ?? JSON.stringify(result)), result)

    if (!ok) {
      console.error(`[Meta CAPI] ${data.eventName} send failed:`, result)
    }

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await logTrackingEvent(supabase, data, 'failed', message.slice(0, 500))
    console.error(`[Meta CAPI] ${data.eventName} send error:`, message)
    return null
  }
}

async function logTrackingEvent(
  supabase: ReturnType<typeof createAdminClient>,
  data: CapiEventData,
  status: string,
  errorMessage: string | null,
  response?: unknown
) {
  try {
    await supabase.from('tracking_events').insert({
      order_id: 'orderId' in data ? (data as CapiOrderData).orderId : null,
      product_id: data.productId || null,
      producer_id: data.producerId,
      platform: 'meta',
      event_name: data.eventName,
      event_id: data.eventId,
      status,
      response: response || null,
      error_message: errorMessage,
    })
  } catch (err) {
    console.warn('[Meta CAPI] Failed to log tracking event:', err)
  }
}

// Re-export para compatibilidade com código existente
export type { CapiOrderData as CapiPurchaseData }
