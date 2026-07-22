import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicRoutes = new Set([
  '/', '/login', '/register', '/forgot-password', '/reset-password',
  '/auth/callback', '/checkout/success', '/accept-invite',
])

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (publicRoutes.has(pathname)) return NextResponse.next()
  if (pathname.startsWith('/_next/')) return NextResponse.next()
  if (pathname.startsWith('/brand/')) return NextResponse.next()
  if (pathname.startsWith('/checkout/')) return NextResponse.next()
  if (pathname === '/contato') return NextResponse.next()
  if (pathname.startsWith('/webhook/')) return NextResponse.next()
  if (pathname.startsWith('/api/checkout/') || pathname.startsWith('/api/webhooks/') || pathname.startsWith('/api/cron/') || pathname.startsWith('/api/meta-ads/webhook') || pathname.startsWith('/api/meta-ads/data-deletion') || pathname === '/api/contact' || pathname === '/api/chat') return NextResponse.next()
  // Cross-domain tracker: /t/[token].js (serve tracker.js) e /api/tr/track (beacon endpoint)
  // São públicos por natureza — o tracker.js roda no browser de visitantes anônimos.
  if (pathname.startsWith('/t/') && pathname.endsWith('.js')) return NextResponse.next()
  if (pathname === '/api/tr/track') return NextResponse.next()

  let supabaseResponse = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            supabaseResponse.cookies.set(name, value)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    // CORREÇÃO W4 (auditoria tracking): o redirect de auth só propagava o pathname,
    // descartando os query strings (UTMs, gclid, fbclid...). Agora propagamos pathname
    // + search para preservar attribution. Após login bem-sucedido, o redirectTo deve
    // reconstruir a URL completa com esses parâmetros.
    url.searchParams.set('redirect', pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
