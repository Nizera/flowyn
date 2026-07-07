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
  if (pathname.startsWith('/webhook/')) return NextResponse.next()
  if (pathname.startsWith('/api/')) return NextResponse.next()

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
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
