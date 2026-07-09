import { NextRequest, NextResponse } from 'next/server'

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'flowyn_webhook_verify_token'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Meta Webhook] Verified successfully')
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn('[Meta Webhook] Verification failed:', { mode, token })
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { object, entry } = body

    if (object === 'page') {
      for (const event of entry || []) {
        console.log('[Meta Webhook] Event received:', {
          id: event.id,
          time: event.time,
        })
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'ok' })
  }
}
