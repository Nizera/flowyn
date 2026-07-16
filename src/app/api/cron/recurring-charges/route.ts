import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createPixAutomaticCharge } from '@/lib/asaas'
import { decryptApiKey } from '@/lib/encryption'
import { safeBearerCompare } from '@/lib/safe-bearer-compare'

export const dynamic = 'force-dynamic'

function maskEmailForOrders(email: string) {
  const [local, domain] = email.split('@')
  return local && domain ? `${local.charAt(0)}***@${domain}` : '***'
}

function isBusinessDay(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    if (isBusinessDay(result)) added++
  }
  return result
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[Cron] CRON_SECRET not configured')
    return NextResponse.json({ error: 'CRON_SECRET not configured.' }, { status: 503 })
  }
  const authHeader = request.headers.get('authorization') || ''
  if (!safeBearerCompare(authHeader, secret)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const minDueDate = formatDate(addBusinessDays(now, 2))

  const { data: activeAuths, error: authError } = await supabase
    .from('pix_automatic_authorizations')
    .select('id, authorization_id, customer_id, product_id, value, buyer_email, asaas_account_id')
    .eq('status', 'ACTIVE')

  if (authError) {
    console.error('[Cron] Error fetching authorizations:', authError.message)
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  if (!activeAuths || activeAuths.length === 0) {
    return NextResponse.json({ message: 'No active authorizations.', created: 0 })
  }

  let created = 0
  let failed = 0

  for (const auth of activeAuths) {
    if (!Number.isFinite(auth.value) || auth.value < 5) {
      console.error(`[Cron] Invalid value for auth ${auth.authorization_id}:`, auth.value)
      failed++
      continue
    }

    // Check if we already created a charge for this authorization THIS MONTH
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { data: existingCharge } = await supabase
      .from('orders')
      .select('id')
      .eq('pix_authorization_id', auth.authorization_id)
      .gte('created_at', currentMonthStart)
      .maybeSingle()

    if (existingCharge) continue

    try {
      let apiKey: string | null = null

      if (auth.asaas_account_id) {
        const { data: producerAccount } = await supabase
          .from('payment_accounts')
          .select('api_key')
          .eq('user_id', auth.asaas_account_id)
          .eq('provider', 'asaas')
          .maybeSingle()

        if (producerAccount?.api_key) {
          apiKey = decryptApiKey(producerAccount.api_key)
        }
      }

      if (!apiKey) {
        apiKey = process.env.ASAAS_API_KEY || null
      }

      if (!apiKey) {
        console.error(`[Cron] No API key for auth ${auth.authorization_id}`)
        failed++
        continue
      }

      const { data: product } = await supabase
        .from('products')
        .select('name')
        .eq('id', auth.product_id)
        .maybeSingle()

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          product_id: auth.product_id,
          plan_id: null,
          affiliate_id: null,
          customer_name: (auth.buyer_email || 'Cliente').split('@')[0] || 'Cliente',
          customer_email: auth.buyer_email ? maskEmailForOrders(auth.buyer_email) : 'cliente@***',
          amount: auth.value,
          commission_rate: 0,
          commission_amount: 0,
          producer_amount: auth.value,
          status: 'pending',
          asaas_customer_id: auth.customer_id,
          payment_provider: 'asaas',
          pix_authorization_id: auth.authorization_id,
          billing_type: 'recurring',
          updated_at: now.toISOString(),
        })
        .select('id')
        .maybeSingle()

      if (orderError || !order) {
        console.error(`[Cron] Failed to create order for auth ${auth.authorization_id}:`, orderError?.message)
        failed++
        continue
      }

      const payment = await createPixAutomaticCharge({
        pixAutomaticAuthorizationId: auth.authorization_id,
        billingType: 'PIX',
        value: auth.value,
        dueDate: minDueDate,
        description: `${product?.name || 'Recorrência'} - Cobrança mensal`,
        externalReference: order.id,
      }, apiKey)

      await supabase
        .from('orders')
        .update({
          asaas_payment_id: payment.id,
          asaas_status: payment.status,
          updated_at: now.toISOString(),
        })
        .eq('id', order.id)

      created++
    } catch (err: unknown) {
      console.error(`[Cron] Error creating charge for auth ${auth.authorization_id}:`, err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200))
      // If the error suggests the authorization is expired/invalid, mark it locally
      const errMsg = err instanceof Error ? err.message.toLowerCase() : ''
      if (errMsg.includes('expired') || errMsg.includes('inactive') || errMsg.includes('invalid authorization') || errMsg.includes('cancelled')) {
        await supabase
          .from('pix_automatic_authorizations')
          .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
          .eq('authorization_id', auth.authorization_id)
        console.log(`[Cron] Marked authorization ${auth.authorization_id} as EXPIRED due to: ${errMsg}`)
      }
      failed++
    }
  }

  return NextResponse.json({ message: 'Done.', created, failed, total: activeAuths.length })
}
