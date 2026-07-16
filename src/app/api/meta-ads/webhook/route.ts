import { NextRequest, NextResponse } from 'next/server'
import { safeTokenEqual } from '@/lib/safe-bearer-compare'

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN

export async function GET(req: NextRequest) {
  if (!VERIFY_TOKEN) {
    return new NextResponse('Service Unavailable', { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && safeTokenEqual(token, VERIFY_TOKEN)) {
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn('[Meta Webhook] Verification failed:', { mode, token })
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    await req.json()

    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'ok' })
  }
}
