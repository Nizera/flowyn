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
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const body = payload as Record<string, unknown>
  const event = Array.isArray(body.entry)
    ? (body.entry[0] as Record<string, unknown> | undefined)
    : undefined
  const changes = Array.isArray(event?.changes)
    ? (event.changes[0] as Record<string, unknown> | undefined)
    : undefined
  const eventType = changes?.field ? String(changes.field) : 'unknown'

  const supabase = createAdminClient()
  const { error } = await supabase.from('whatsapp_webhook_logs').insert({
    event_type: eventType,
    payload: body,
    status: 'received',
  })

  if (error) {
    console.error('[WhatsApp Webhook] Insert failed:', error.message)
    return NextResponse.json({ error: 'Could not log webhook' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
