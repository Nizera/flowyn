import { NextRequest, NextResponse } from 'next/server'
import { hashIdentifier } from '@/lib/hash'
import { resendOrderDelivery } from '@/lib/order-delivery'
import { createAdminClient } from '@/utils/supabase/admin'
import { getClientIp } from '@/lib/client-ip'

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(req: NextRequest) {
  let orderId = ''
  let customerEmail = ''
  try {
    const body = await req.json()
    orderId = String(body.order_id || '')
    customerEmail = String(body.customer_email || '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Requisicao invalida.' }, { status: 400 })
  }

  if (!isUuid(orderId)) {
    return NextResponse.json({ error: 'Pedido invalido.' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return NextResponse.json({ error: 'Informe o e-mail usado na compra.' }, { status: 400 })
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

  const { data: customer } = await supabase
    .from('order_customer_private')
    .select('customer_email')
    .eq('order_id', orderId)
    .maybeSingle()

  if (!customer?.customer_email || customer.customer_email.trim().toLowerCase() !== customerEmail) {
    return NextResponse.json({ error: 'Nao encontramos esse e-mail para este pedido.' }, { status: 403 })
  }

  const result = await resendOrderDelivery(supabase, orderId)
  if (!result.sent) {
    return NextResponse.json({ error: 'Nao foi possivel reenviar a entrega agora.' }, { status: 400 })
  }

  return NextResponse.json({ sent: true })
}
