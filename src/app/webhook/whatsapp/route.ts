import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

const WHATSAPP_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN || 'flowyn123'

type WhatsAppEntry = {
  id: string
  changes: {
    value: {
      messaging_product: string
      metadata: {
        display_phone_number: string
        phone_number_id: string
      }
      contacts?: { profile: { name: string }; wa_id: string }[]
      messages?: {
        from: string
        id: string
        timestamp: string
        text?: { body: string }
        type: 'text' | 'interactive' | 'button' | 'order' | 'unknown'
      }[]
      statuses?: {
        id: string
        status: string
        timestamp: string
        recipient_id: string
        type: 'message'
      }[]
    }
    field: string
  }[]
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const rawToken = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const token = rawToken ? decodeURIComponent(rawToken) : null

  if (mode === 'subscribe' && token === WHATSAPP_TOKEN && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  if (!mode && !token) {
    return new NextResponse(
      'WhatsApp Webhook endpoint. Use with Meta Cloud API configuration.',
      { status: 200 },
    )
  }

  return new NextResponse('Forbidden: verify_token invalido', { status: 403 })
}

export async function POST(req: NextRequest) {
  const authToken = req.headers.get('x-webhook-token')

  if (authToken && authToken !== WHATSAPP_TOKEN) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  let body: { object?: string; entry?: WhatsAppEntry[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.object !== 'whatsapp_business_account' || !body.entry?.length) {
    return NextResponse.json({ error: 'Not a WhatsApp notification' }, { status: 400 })
  }

  const supabase = createAdminClient()

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      const { value } = change

      if (value.messages?.length) {
        for (const msg of value.messages) {
          const contact = value.contacts?.[0]
          const payload = {
            wa_phone_number_id: value.metadata.phone_number_id,
            wa_from: msg.from,
            wa_message_id: msg.id,
            wa_contact_name: contact?.profile.name || null,
            message_type: msg.type,
            message_body: msg.text?.body || null,
            timestamp: msg.timestamp,
            entry_id: entry.id,
            raw_payload: value,
          }

          await supabase.from('whatsapp_webhook_logs').insert({
            event_type: 'message_received',
            payload,
            status: 'pending',
          })
        }
      }

      if (value.statuses?.length) {
        for (const status of value.statuses) {
          await supabase.from('whatsapp_webhook_logs').insert({
            event_type: `status_${status.status}`,
            payload: {
              wa_message_id: status.id,
              status: status.status,
              timestamp: status.timestamp,
              recipient_id: status.recipient_id,
              entry_id: entry.id,
            },
            status: 'received',
          })
        }
      }
    }
  }

  return NextResponse.json({ success: true })
}
