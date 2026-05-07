import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { asaasRequest, calculateAsaasSplit } from '@/lib/asaas'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  console.log('[Checkout] Início da requisição POST')
  try {
    const body = await request.json()
    const { plan_id, customer_name, customer_email, affiliate_id, tracking_id } = body

    if (!plan_id || !customer_name || !customer_email) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: plan_id, customer_name, customer_email' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()

    // Fetch plan + product + producer
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*, product:products(id, name, commission_rate, webhook_url, owner_id)')
      .eq('id', plan_id)
      .single()

    if (planError || !plan) {
      console.error('[Checkout] Plan fetch failed:', planError)
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

    const product = plan.product as any
    const commissionRate = Number(product.commission_rate)
    const amount = Number(plan.price)
    
    // Fetch producer profile for Asaas Wallet ID
    const { data: producer } = await supabase
      .from('profiles')
      .select('asaas_wallet_id')
      .eq('id', product.owner_id)
      .single()

    // Fetch affiliate profile for Asaas Wallet ID (if applicable)
    let affiliateWalletId = null
    if (affiliate_id) {
      const { data: affiliate } = await supabase
        .from('profiles')
        .select('asaas_wallet_id')
        .eq('id', affiliate_id)
        .single()
      affiliateWalletId = affiliate?.asaas_wallet_id
    }

    // Create pending order
    const orderId = crypto.randomUUID()
    const commissionAmount = (amount * commissionRate) / 100

    const { error: orderError } = await supabase
      .from('orders')
      .insert({
        id: orderId,
        product_id: product.id,
        plan_id: plan.id,
        affiliate_id: affiliate_id || null,
        customer_name,
        customer_email,
        amount,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        status: 'pending',
        tracking_id: tracking_id || null,
      })

    if (orderError) {
      console.error('[Checkout] Order creation failed:', orderError)
      return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 })
    }

    // 1. Ensure Customer exists in Asaas
    let asaasCustomerId: string
    const customers = await asaasRequest(`/customers?email=${customer_email}`)
    
    if (customers.data && customers.data.length > 0) {
      asaasCustomerId = customers.data[0].id
    } else {
      const newCustomer = await asaasRequest('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: customer_name,
          email: customer_email,
          externalReference: customer_email,
        })
      })
      asaasCustomerId = newCustomer.id
    }

    // 2. Calculate Split
    const { platformFee, affiliateCommission } = calculateAsaasSplit(amount, commissionRate)
    
    const splitRules = []
    
    // Platform Split (Flowyn)
    // In a real scenario, the main account is Flowyn, 
    // and the split goes to Producer and Affiliate.
    // However, if the main account is the "Platform Account", 
    // the split is defined for the subaccounts.
    
    if (producer?.asaas_wallet_id) {
      splitRules.push({
        walletId: producer.asaas_wallet_id,
        fixedValue: amount - platformFee - (affiliateWalletId ? affiliateCommission : 0),
      })
    }

    if (affiliate_id && affiliateWalletId && affiliateCommission > 0) {
      splitRules.push({
        walletId: affiliateWalletId,
        fixedValue: affiliateCommission,
      })
    }

    // 3. Create Payment (One-time or Subscription)
    const isSubscription = plan.billing_cycle && plan.billing_cycle !== 'NONE'
    const endpoint = isSubscription ? '/subscriptions' : '/payments'
    
    const paymentRequest: any = {
      customer: asaasCustomerId,
      billingType: 'UNDEFINED',
      value: amount,
      description: `${product.name} - ${plan.name}`,
      externalReference: orderId,
      split: splitRules.length > 0 ? splitRules : undefined,
    }

    if (isSubscription) {
      paymentRequest.cycle = plan.billing_cycle
      paymentRequest.nextDueDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().split('T')[0]
    } else {
      paymentRequest.dueDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().split('T')[0]
    }

    console.log(`[Checkout] Creating Asaas ${isSubscription ? 'subscription' : 'payment'}`)
    const asaasResponse = await asaasRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(paymentRequest)
    })

    // 4. Update order with Asaas ID and Invoice URL
    await supabase
      .from('orders')
      .update({ 
        asaas_payment_id: isSubscription ? undefined : asaasResponse.id,
        asaas_subscription_id: isSubscription ? asaasResponse.id : undefined,
        asaas_invoice_url: asaasResponse.invoiceUrl,
        platform_fee: platformFee,
        producer_amount: amount - platformFee - (affiliateWalletId ? affiliateCommission : 0),
      })
      .eq('id', orderId)

    console.log('[Checkout] Sucesso! Redirecionando para:', asaasResponse.invoiceUrl)
    return NextResponse.json({
      success: true,
      order_id: orderId,
      checkout_url: asaasResponse.invoiceUrl,
    })

  } catch (err: any) {
    console.error('[Checkout] Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
}

