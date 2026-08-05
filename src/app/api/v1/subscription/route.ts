import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de API obrigatório' }, { status: 401 })
    }

    const apiKey = authHeader.substring(7)
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

    const rl = rateLimit(`v1:${keyHash}`, 60, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit excedido. Tente novamente em breve.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        },
      )
    }

    const admin = createAdminClient()

    const { data: keyData, error: keyError } = await admin
      .from('producer_api_keys')
      .select('id, producer_id, permissions, is_active, expires_at')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single()

    if (keyError || !keyData) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expirado' }, { status: 401 })
    }

    if (!keyData.permissions.includes('subscription:read')) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    await admin
      .from('producer_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyData.id)

    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')
    const productId = searchParams.get('product_id')

    if (!email && !productId) {
      return NextResponse.json({ error: 'Forneça email ou product_id' }, { status: 400 })
    }

    const { data: customer } = await admin
      .from('order_customer_private')
      .select('order_id')
      .ilike('customer_email', email || '')
      .limit(1)
      .single()

    if (!customer) {
      return NextResponse.json({ active: false, status: 'not_found' })
    }

    const { data: order } = await admin
      .from('orders')
      .select('id, plan_id, status, asaas_subscription_id, asaas_status, created_at')
      .eq('id', customer.order_id)
      .eq('producer_id', keyData.producer_id)
      .single()

    if (!order) {
      return NextResponse.json({ active: false, status: 'not_found' })
    }

    if (productId && order.plan_id) {
      const { data: plan } = await admin
        .from('plans')
        .select('product_id')
        .eq('id', order.plan_id)
        .single()

      if (plan?.product_id !== productId) {
        return NextResponse.json({ active: false, status: 'not_found' })
      }
    }

    const isActive = order.status === 'paid' || order.asaas_status === 'ACTIVE'
    const isTrialing = order.asaas_status === 'TRIALING'

    let planName: string | null = null
    let billingCycle: string | null = null

    if (order.plan_id) {
      const { data: plan } = await admin
        .from('plans')
        .select('name, billing_type')
        .eq('id', order.plan_id)
        .single()

      planName = plan?.name || null
      billingCycle = plan?.billing_type || null
    }

    return NextResponse.json({
      active: isActive || isTrialing,
      status: isTrialing ? 'trialing' : isActive ? 'active' : order.status,
      plan_name: planName,
      billing_cycle: billingCycle,
      subscription_id: order.asaas_subscription_id,
      created_at: order.created_at,
    })
  } catch (err) {
    console.error('[V1 Subscription Status]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
