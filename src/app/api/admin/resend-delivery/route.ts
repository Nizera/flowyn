import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resendOrderDelivery } from '@/lib/order-delivery'
import { safeBearerCompare } from '@/lib/safe-bearer-compare'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = process.env.REPROCESS_SECRET || process.env.ASAAS_WEBHOOK_SECRET
  const authHeader = req.headers.get('authorization') || ''
  if (!secret || !safeBearerCompare(authHeader, secret)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let body: { customer_email?: string; order_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido.' }, { status: 400 })
  }

  const customerEmail = body.customer_email?.trim().toLowerCase()
  const orderId = body.order_id?.trim()

  if (!customerEmail && !orderId) {
    return NextResponse.json({ error: 'Informe customer_email ou order_id.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  let targetOrderId = orderId

  if (!targetOrderId && customerEmail) {
    const { data: customer } = await supabase
      .from('order_customer_private')
      .select('order_id')
      .ilike('customer_email', customerEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!customer?.order_id) {
      return NextResponse.json({ error: 'Nenhum pedido encontrado para este e-mail.' }, { status: 404 })
    }
    targetOrderId = customer.order_id
  }

  const result = await resendOrderDelivery(supabase, targetOrderId!)

  if (!result.sent) {
    return NextResponse.json({ error: 'Nao foi possivel reenviar.', reason: result.reason }, { status: 400 })
  }

  return NextResponse.json({ sent: true, order_id: targetOrderId })
}
