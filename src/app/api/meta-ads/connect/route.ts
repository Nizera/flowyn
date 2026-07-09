import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getMetaOAuthUrl } from '@/lib/meta-oauth'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const META_APP_ID = process.env.META_APP_ID
  if (!META_APP_ID) {
    return NextResponse.json(
      { error: 'Meta App não configurado. Aguarde a configuração da integração.' },
      { status: 503 }
    )
  }

  const oauthUrl = getMetaOAuthUrl(user.id)
  return NextResponse.redirect(oauthUrl)
}