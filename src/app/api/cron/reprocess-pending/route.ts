import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { retrievePayment } from '@/lib/asaas'
import { decryptApiKey } from '@/lib/encryption'
import { fulfillPaidOrder } from '@/lib/order-fulfillment'
import { safeBearerCompare } from '@/lib/safe-bearer-compare'

export const dynamic = 'force-dynamic'

const PAID_STATUSES = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'])
const MAX_ORDERS = 50
const STALE_MINUTES = 2
const MAX_AGE_DAYS = 30

export async function POST(request: NextRequest) {
  const secret = process.env.REPROCESS_SECRET || process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization') || ''
  if (!secret || !safeBearerCompare(authHeader, secret)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString()
  const maxAge = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: pendingOrders, error: fetchError } = await supabase
    .from('orders')
    .select('id, product_id, asaas_payment_id')
    .eq('status', 'pending')
    .not('asaas_payment_id', 'is', null)
    .lt('created_at', cutoff)
    .gt('created_at', maxAge)
    .order('created_at', { ascending: true })
    .limit(MAX_ORDERS)

  if (fetchError) {
    console.error('[Cron Reprocess] Error fetching orders:', fetchError.message)
    return NextResponse.json({ error: 'Erro ao buscar pedidos.' }, { status: 500 })
  }

  if (!pendingOrders || pendingOrders.length === 0) {
    return NextResponse.json({ message: 'Nenhum pedido pendente.', processed: 0 })
  }

  let processed = 0
  let skipped = 0
  let failed = 0
  let cancelled = 0

  for (const order of pendingOrders) {
    try {
      let apiKey = process.env.ASAAS_API_KEY

      if (order.product_id) {
        const { data: product } = await supabase
          .from('products')
          .select('owner_id')
          .eq('id', order.product_id)
          .maybeSingle()

        if (product?.owner_id) {
          const { data: producerAccount } = await supabase
            .from('payment_accounts')
            .select('api_key, connection_mode')
            .eq('user_id', product.owner_id)
            .eq('provider', 'asaas')
            .maybeSingle()

          if (producerAccount?.connection_mode === 'standalone' && producerAccount?.api_key) {
            apiKey = decryptApiKey(producerAccount.api_key)
          }
        }
      }

      if (!apiKey) {
        console.error(`[Cron Reprocess] No API key for order ${order.id}`)
        failed++
        continue
      }

      const payment = await retrievePayment(order.asaas_payment_id!, apiKey)
      const paymentStatus = payment.status ? String(payment.status) : null

      if (!paymentStatus || !PAID_STATUSES.has(paymentStatus)) {
        skipped++
        continue
      }

      await fulfillPaidOrder(supabase, order.id, paymentStatus)
      processed++

      await supabase.from('security_audit_log').insert({
        action: 'CRON_REPROCESS_ORDER',
        entity_type: 'order',
        entity_id: order.id,
        metadata: { payment_id: order.asaas_payment_id, asaas_status: paymentStatus },
      })
    } catch (err) {
      const statusCode = (err as Error & { statusCode?: number }).statusCode
      if (statusCode === 404) {
        await supabase
          .from('orders')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', order.id)
        cancelled++
        continue
      }
      console.error(`[Cron Reprocess] Error for order ${order.id}:`, err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200))
      failed++
    }
  }

  return NextResponse.json({
    message: 'Done.',
    total: pendingOrders.length,
    processed,
    skipped,
    failed,
    cancelled,
  })
}
