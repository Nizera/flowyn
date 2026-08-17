import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { safeTokenEqual } from '@/lib/safe-bearer-compare'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && safeTokenEqual(token, process.env.WHATSAPP_VERIFY_TOKEN || '')) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  // TEMPORARIAMENTE DESABILITADO
  return NextResponse.json(
    { error: 'WhatsApp CRM está temporariamente indisponível' },
    { status: 503 }
  )
}
