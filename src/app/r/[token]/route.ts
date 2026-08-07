import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Redirect server-side: resolve public_token → pixel config, seta cookies
// first-party no domínio da Flowyn com UTMs/click IDs, e redireciona pro checkout.
//
// O tracker.js (v2) na landing page já injeta o pixel Meta e fire PageView/ViewContent/InitiateCheckout.
// Este endpoint apenas planteia cookies e redireciona. CAPI PageView não é necessário aqui
// porque o tracker.js já fez o beacon para /api/tr/track.

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return new NextResponse('not found', { status: 404 })
  }

  const supabase = createAdminClient()
  const { data: pixel } = await supabase
    .from('pixels')
    .select('id, user_id, is_active, platform')
    .eq('public_token', token)
    .eq('platform', 'meta')
    .maybeSingle()

  if (!pixel || !pixel.is_active) {
    return new NextResponse('not found', { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const dest = searchParams.get('dest') || '/'

  // UTMs e click IDs da query string
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck']
  const clickKeys = ['fbclid', 'ttclid', 'gclid']

  const trackingData: Record<string, string> = {}

  // 1. Lê da query string (prioridade)
  for (const key of [...utmKeys, ...clickKeys]) {
    const val = searchParams.get(key)
    if (val) trackingData[key] = val
  }

  // 2. Fallback: lê do cookie _fl_utm (setado pelo tracker.js na landing)
  if (Object.keys(trackingData).length === 0) {
    const flUtmCookie = req.cookies.get('_fl_utm')?.value
    if (flUtmCookie) {
      try {
        const parsed = JSON.parse(flUtmCookie) as Record<string, string>
        for (const key of [...utmKeys, ...clickKeys]) {
          if (parsed[key] && !trackingData[key]) {
            trackingData[key] = parsed[key]
          }
        }
      } catch {}
    }
  }

  // 3. Fallback: extrai UTMs do header Referer (landing page URL com UTMs)
  //    Quando tracker.js é bloqueado (ad blocker/JS error), o inject() não roda
  //    e as UTMs não chegam via query string. O Referer ainda contém a URL
  //    original da landing com os UTMs do Meta Ads.
  if (Object.keys(trackingData).length === 0) {
    const referer = req.headers.get('referer')
    if (referer) {
      try {
        const refererUrl = new URL(referer)
        for (const key of [...utmKeys, ...clickKeys]) {
          const val = refererUrl.searchParams.get(key)
          if (val && !trackingData[key]) {
            trackingData[key] = val
          }
        }
      } catch {}
    }
  }

  // Session ID
  const existingSid = req.cookies.get('_fl_sid')?.value
  const sid = existingSid || crypto.randomUUID()

  // Monta URL de destino com UTMs preservadas
  const destUrl = new URL(dest, req.url)

  // Query params não-UTM do redirect (ex: plan_id, etc.)
  for (const [key, val] of searchParams.entries()) {
    if (!utmKeys.includes(key) && !clickKeys.includes(key) && key !== 'dest' && key !== 'sid') {
      destUrl.searchParams.set(key, val)
    }
  }

  // Injeta UTMs na URL de destino
  for (const [key, val] of Object.entries(trackingData)) {
    if (!destUrl.searchParams.has(key)) {
      destUrl.searchParams.set(key, val)
    }
  }
  destUrl.searchParams.set('fl_sid', sid)

  // Response com cookies first-party
  const response = NextResponse.redirect(destUrl.toString(), 302)

  // Cookie _fl_sid (30 dias)
  response.cookies.set('_fl_sid', sid, {
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    sameSite: 'lax',
    secure: true,
    httpOnly: false, // Precisa ser acessível via JS no tracker.js
  })

  // Cookie _fl_utm com tracking data (30 dias)
  if (Object.keys(trackingData).length > 0) {
    response.cookies.set('_fl_utm', JSON.stringify(trackingData), {
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
      secure: true,
      httpOnly: false,
    })
  }

  // Planta _fbp/_fbc no domínio Flowyn (recebidos via query params do tracker.js)
  const fbp = searchParams.get('_fbp')
  const fbc = searchParams.get('_fbc')
  if (fbp) {
    response.cookies.set('_fbp', fbp, {
      path: '/',
      maxAge: 90 * 24 * 60 * 60,
      sameSite: 'lax',
      secure: true,
      httpOnly: false,
    })
  }
  if (fbc) {
    response.cookies.set('_fbc', fbc, {
      path: '/',
      maxAge: 90 * 24 * 60 * 60,
      sameSite: 'lax',
      secure: true,
      httpOnly: false,
    })
  }

  // ── Server-side tracking (bypass Cloudflare) ──
  // Grava page_view em tracking_external_events e dispara CAPI PageView.
  // Isso garante rastreamento mesmo que o beacon do tracker.js seja bloqueado.
  // Executa de forma não-bloqueante para não atrasar o redirect.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || ''
  const userAgent = req.headers.get('user-agent') || ''
  const eventSourceUrl = req.headers.get('referer') || req.url

  // Extrai product_id do dest (ex: /checkout/PLAN_UUID → plan UUID)
  let productId: string | null = null
  const destMatch = dest.match(/\/checkout\/([0-9a-f-]{36})/i)
  if (destMatch) {
    // Resolve plan → product_id
    try {
      const { data: plan } = await supabase
        .from('plans')
        .select('product_id')
        .eq('id', destMatch[1])
        .maybeSingle()
      if (plan?.product_id) productId = plan.product_id
    } catch {}
  }

  // Insert tracking_external_events (não-bloqueante, para analytics interno)
  supabase.from('tracking_external_events').insert({
    user_id: pixel.user_id,
    pixel_id: pixel.id,
    product_id: productId,
    event_name: 'page_view',
    url: eventSourceUrl.slice(0, 2000),
    referrer: req.headers.get('referer')?.slice(0, 2000) || null,
    utm_source: trackingData.utm_source || null,
    utm_medium: trackingData.utm_medium || null,
    utm_campaign: trackingData.utm_campaign || null,
    utm_content: trackingData.utm_content || null,
    utm_term: trackingData.utm_term || null,
    fbclid: trackingData.fbclid || null,
    ttclid: trackingData.ttclid || null,
    gclid: trackingData.gclid || null,
    _fbp: fbp || null,
    _fbc: fbc || null,
    client_ip: ip,
    user_agent: userAgent.slice(0, 500),
    session_id: sid,
  }).then(({ error }) => {
    if (error) console.error('[/r/] tracking_external_events insert failed:', error.message)
  })

  return response
}
