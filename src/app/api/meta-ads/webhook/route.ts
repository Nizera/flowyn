import { NextRequest, NextResponse } from 'next/server'
import { safeTokenEqual } from '@/lib/safe-bearer-compare'
import { createHmac } from 'node:crypto'

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN
const APP_SECRET = process.env.META_APP_SECRET

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

  console.warn('[Meta Webhook] Verification failed:', { mode })
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify Meta's HMAC-SHA256 signature if APP_SECRET is configured
  if (APP_SECRET) {
    const signature = req.headers.get('x-hub-signature-256')
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    const expectedSig = 'sha256=' + createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')

    if (!safeTokenEqual(signature, expectedSig)) {
      console.warn('[Meta Webhook] Signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  try {
    const body = JSON.parse(rawBody)
    // TODO: Process webhook events (leadgen, pages, etc.)
    console.log('[Meta Webhook] Event received:', body.object)
    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
}
