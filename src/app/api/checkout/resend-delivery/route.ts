import { NextRequest, NextResponse } from 'next/server'
import { hashIdentifier } from '@/lib/hash'
import { resendOrderDelivery } from '@/lib/order-delivery'
import { createAdminClient } from '@/utils/supabase/admin'

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return req.headers.get('x-real-ip') || '127.0.0.1'
}

export async function POST(req: NextRequest) {
  let orderId = ''
  try {
    const body = await req.json()
    orderId = String(body.order_id || '')
  } catch {
    return NextResponse.json({ error: 'Requisicao invalida.' }, { status: 400 })
  }

  if (!isUuid(orderId)) {
    return NextResponse.json({ error: 'Pedido invalido.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: withinRateLimit, error: rateLimitError } = await supabase.rpc('consume_rate_limit', {
    requested_bucket: 'delivery_resend',
    requested_identifier_hash: await hashIdentifier(`${getClientIp(req)}:${orderId}`),
    max_requests: 3,
    window_seconds: 900,
  })

  if (rateLimitError || !withinRateLimit) {
    return NextResponse.json({ error: 'Aguarde alguns minutos antes de reenviar novamente.' }, { status: 429 })
  }

  const result = await resendOrderDelivery(supabase, orderId)
  if (!result.sent) {
    return NextResponse.json({ error: 'Nao foi possivel reenviar a entrega agora.' }, { status: 400 })
  }

  return NextResponse.json({ sent: true })
}
