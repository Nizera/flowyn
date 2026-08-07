import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getClientIp } from '@/lib/client-ip'
import { sendCapiEvent } from '@/lib/meta-capi'

// Tracking cross-domain: recebe page_view / view_content da landing externa do
// produtor via tracker.js (snippet JS). O snippet carrega
// `<script src="https://flowyn.com/t/PUBLIC_TOKEN.js">` — esse endpoint resolve
// o public_token via DB e grava o evento em tracking_external_events.
//
// Sempre responde 200 mesmo em erro (para o tracker.js não logar warnings
// inúteis no console do cliente).

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  try {
    const rawBody = await req.text()
    if (rawBody.length > 8_192) {
      return new NextResponse('too large', { status: 413, headers: corsHeaders })
    }

    let body: TrackBody
    try {
      body = JSON.parse(rawBody)
    } catch {
      return new NextResponse('bad json', { status: 400, headers: corsHeaders })
    }

    const { t, event_name, product_id, url, referrer, utm, fbclid, ttclid, gclid, session_id, fbp, fbc, event_id, external_id } = body
    if (!t || !event_name) {
      return new NextResponse('missing params', { status: 400, headers: corsHeaders })
    }
    const VALID_EVENTS = ['page_view', 'view_content', 'initiate_checkout']
    if (!VALID_EVENTS.includes(event_name)) {
      return new NextResponse('invalid event', { status: 400, headers: corsHeaders })
    }

    const supabase = createAdminClient()

    // Resolve o pixel_row (e user_id) a partir do public_token
    const { data: pixelRow } = await supabase
      .from('pixels')
      .select('id, user_id, platform, is_active')
      .eq('public_token', t)
      .eq('platform', 'meta')
      .maybeSingle()

    if (!pixelRow || !pixelRow.is_active) {
      // Pixel não encontrado ou inativo. Retorna 200 silencioso para não poluir console.
      return new NextResponse('ok', { status: 200, headers: corsHeaders })
    }

    const ip = getClientIp(req)
    const userAgent = req.headers.get('user-agent') || ''
    const finalSessionId = session_id || crypto.randomUUID()
    const finalUrl = url || req.headers.get('referer') || ''

    const { error } = await supabase.from('tracking_external_events').insert({
      user_id: pixelRow.user_id,
      pixel_id: pixelRow.id,
      product_id: product_id ?? null,
      event_name,
      url: finalUrl.slice(0, 2000),
      referrer: (referrer ?? req.headers.get('referer'))?.slice(0, 2000) || null,
      utm_source: utm?.utm_source || null,
      utm_medium: utm?.utm_medium || null,
      utm_campaign: utm?.utm_campaign || null,
      utm_content: utm?.utm_content || null,
      utm_term: utm?.utm_term || null,
      fbclid: fbclid || null,
      ttclid: ttclid || null,
      gclid: gclid || null,
      _fbp: fbp || null,
      _fbc: fbc || null,
      client_ip: ip,
      user_agent: userAgent.slice(0, 500),
      session_id: finalSessionId,
    })

    if (error) {
      console.error('[tracker] DB insert failed:', error.message)
    }

    // CAPI server-side (não-bloqueante)
    const CAPI_EVENT_MAP: Record<string, string> = {
      page_view: 'PageView',
      view_content: 'ViewContent',
      initiate_checkout: 'InitiateCheckout',
    }
    const capiEventName = CAPI_EVENT_MAP[event_name] as 'PageView' | 'ViewContent' | 'InitiateCheckout'
    const finalEventId = event_id || `${event_name}_${crypto.randomUUID()}`

    const trackingParams: Record<string, string> = {}
    if (utm?.utm_source) trackingParams.utm_source = utm.utm_source
    if (utm?.utm_medium) trackingParams.utm_medium = utm.utm_medium
    if (utm?.utm_campaign) trackingParams.utm_campaign = utm.utm_campaign
    if (utm?.utm_content) trackingParams.utm_content = utm.utm_content
    if (utm?.utm_term) trackingParams.utm_term = utm.utm_term
    if (fbclid) trackingParams.fbclid = fbclid
    if (fbp) trackingParams._fbp = fbp
    if (fbc) trackingParams._fbc = fbc

    sendCapiEvent({
      eventId: finalEventId,
      eventName: capiEventName,
      pixelId: pixelRow.id,
      productId: product_id || undefined,
      producerId: pixelRow.user_id,
      clientIp: ip,
      userAgent,
      eventSourceUrl: finalUrl,
      trackingParams: Object.keys(trackingParams).length > 0 ? trackingParams : null,
      externalId: external_id || undefined,
    }).catch(err => {
      console.error(`[Tracker CAPI] ${capiEventName} failed (non-blocking):`, err)
    })

    return new NextResponse(JSON.stringify({ sid: finalSessionId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[tracker] error:', err)
    return new NextResponse('ok', { status: 200, headers: corsHeaders })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(req.headers.get('origin')) })
}

interface TrackBody {
  t: string                // public_token do pixel (UUID)
  event_name: string
  product_id?: string | null
  url?: string
  referrer?: string | null
  utm?: Record<string, string> | null
  fbclid?: string | null
  ttclid?: string | null
  gclid?: string | null
  fbp?: string | null
  fbc?: string | null
  session_id?: string | null
  event_id?: string | null  // ID do evento para dedup com pixel client-side
  external_id?: string | null  // ID anônimo persistente (_fl_uid) para Advanced Matching
}

const ALLOWED_ORIGINS = [
  'https://www.flowyn.com.br',
  'https://flowyn.com.br',
  'https://despertarnosonho.vercel.app',
  'http://localhost:3000',
]

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}
