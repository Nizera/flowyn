import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isSafeRedirectPath } from '@/lib/validation'

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const requestedNext = searchParams.get('next')
  const next = requestedNext && isSafeRedirectPath(requestedNext) ? requestedNext : '/login'

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Link inválido ou expirado')}`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch { /* Server Component — ignore */ }
        },
      },
    }
  )

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery',
  })

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Link inválido ou expirado')}`)
  }

  const resetParams = new URLSearchParams({ next })
  return NextResponse.redirect(`${origin}/reset-password?${resetParams.toString()}`)
}
