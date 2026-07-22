import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getClientIp } from '@/lib/client-ip'

// Tracking cross-domain: recebe page_view / view_content da landing externa do
// produtor via tracker.js (snippet JS). O snippet carrega
// `<script src="https://flowyn.com/t/PUBLIC_TOKEN.js">` — esse endpoint resolve
// o public_token via DB e grava o evento em tracking_external_events.
//
// Sempre responde 200 mesmo em erro (para o tracker.js não logar warnings
// inúteis no console do cliente).

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    if (rawBody.length > 8_192) {
      return new NextResponse('too large', { status: 413, headers: CORS_HEADERS })
    }

    let body: TrackBody
    try {
      body = JSON.parse(rawBody)
    } catch {
      return new NextResponse('bad json', { status: 400, headers: CORS_HEADERS })
    }

    const { t, event_name, product_id, url, referrer, utm, fbclid, ttclid, gclid, session_id } = body
    if (!t || !event_name) {
      return new NextResponse('missing params', { status: 400, headers: CORS_HEADERS })
    }
    if (event_name !== 'page_view' && event_name !== 'view_content') {
      return new NextResponse('invalid event', { status: 400, headers: CORS_HEADERS })
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
      return new NextResponse('ok', { status: 200, headers: CORS_HEADERS })
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
      client_ip: ip,
      user_agent: userAgent.slice(0, 500),
      session_id: finalSessionId,
    })

    if (error) {
      console.error('[tracker] DB insert failed:', error.message)
    }

    return new NextResponse(JSON.stringify({ sid: finalSessionId }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[tracker] error:', err)
    return new NextResponse('ok', { status: 200, headers: CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
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
  session_id?: string | null
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin',
}
