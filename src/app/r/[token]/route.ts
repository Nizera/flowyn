import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Redirect server-side: resolve public_token → pixel config, seta cookies
// first-party no domínio da Flowyn com UTMs/click IDs, e redireciona pro checkout.
//
// Uso pelo produtor na landing externa em vez de link direto pro checkout:
//   <a href="https://flowyn.com/r/PUBLIC_TOKEN?dest=/checkout/PLAN_ID&utm_source=...">
//
// Vantagens sobre a interceptação de clique no DOM (tracker.js inject()):
// 1. Funciona com qualquer tipo de botão (<a>, <button>, SPA routing, etc.)
// 2. Não depende de DOMContentLoaded ou captura de eventos
// 3. Cookies são plantados no domínio Flowyn (first-party) antes do redirect
// 4. Funciona mesmo se o tracker.js não estiver instalado na landing

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

  return response
}
