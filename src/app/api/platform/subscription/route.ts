import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  cancelSubscription,
  createCreditCardSubscription,
  createCustomer,
  createSubaccount,
  onlyDigits,
} from '@/lib/asaas'
import { isValidCardExpiry, isValidCpfCnpj, isValidEmail, isValidPhone, isValidCardNumber, isValidCvv, isValidPostalCode } from '@/lib/validation'
import { hashIdentifier } from '@/lib/hash'

const FLOWYN_PRO_PRICE = 97

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return req.headers.get('x-real-ip') || '127.0.0.1'
}

function isoDate(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date()
  return date.toISOString().slice(0, 10)
}

function isFuture(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now())
}

async function getCurrentUserId() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user.id
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const { data: subscription } = await supabase
    .from('platform_subscriptions')
    .select('id, user_id, status, asaas_customer_id, asaas_subscription_id, trial_ends_at, current_period_ends_at, last_payment_status')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: invoices } = subscription
    ? await supabase
        .from('platform_subscription_invoices')
        .select('asaas_payment_id, status, value, due_date, paid_at, created_at')
        .eq('platform_subscription_id', subscription.id)
        .order('created_at', { ascending: false })
        .limit(10)
    : { data: [] }

  return NextResponse.json({ subscription, invoices: invoices || [] })
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin || origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Origem da requisição inválida.' }, { status: 403 })
  }

  const contentLength = Number(req.headers.get('content-length') || 0)
  if (contentLength > 16_384) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 413 })
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const clientIp = getClientIp(req)
  const { data: withinRateLimit, error: rateLimitError } = await admin.rpc('consume_rate_limit', {
    requested_bucket: 'platform-subscription',
    requested_identifier_hash: await hashIdentifier(clientIp),
    max_requests: 5,
    window_seconds: 15 * 60,
  })

  if (rateLimitError) {
    return NextResponse.json({ error: 'Assinatura temporariamente indisponivel.' }, { status: 503 })
  }

  if (!withinRateLimit) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, { status: 429 })
  }

  const body = await req.json()
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim()
  const cpfCnpj = onlyDigits(body.cpfCnpj)
  const phone = onlyDigits(body.phone)
  const postalCode = onlyDigits(body.postalCode)
  const addressNumber = String(body.addressNumber || '').trim()
  const cardNumber = onlyDigits(body.card?.number)
  const cardCcv = onlyDigits(body.card?.ccv)
  const cardExpiryMonth = String(body.card?.expiryMonth || '').padStart(2, '0')
  const cardExpiryYear = String(body.card?.expiryYear || '')

  if (!name || !email || !cpfCnpj || !phone || !postalCode || !addressNumber) {
    return NextResponse.json({ error: 'Preencha todos os dados obrigatórios.' }, { status: 400 })
  }

  if (!isValidEmail(email) || !isValidCpfCnpj(cpfCnpj) || !isValidPhone(phone)) {
    return NextResponse.json({ error: 'Informe e-mail, CPF/CNPJ e telefone válidos.' }, { status: 400 })
  }

  if (!isValidPostalCode(postalCode)) {
    return NextResponse.json({ error: 'Informe um CEP válido com 8 dígitos.' }, { status: 400 })
  }

  if (!isValidCardNumber(cardNumber) || !isValidCvv(cardCcv) || !isValidCardExpiry(cardExpiryMonth, cardExpiryYear)) {
    return NextResponse.json({ error: 'Confira os dados do cartão.' }, { status: 400 })
  }

  let { data: localSubscription } = await admin
    .from('platform_subscriptions')
    .select('id, user_id, status, asaas_customer_id, asaas_subscription_id, trial_ends_at, current_period_ends_at, last_payment_status')
    .eq('user_id', userId)
    .maybeSingle()

  if (!localSubscription) {
    const { data: createdSubscription, error: createError } = await admin
      .from('platform_subscriptions')
      .insert({ user_id: userId })
      .select('id, user_id, status, asaas_customer_id, asaas_subscription_id, trial_ends_at, current_period_ends_at, last_payment_status')
      .single()

    if (createError || !createdSubscription) {
      return NextResponse.json({ error: 'Nao foi possivel iniciar o periodo gratuito.' }, { status: 500 })
    }

    localSubscription = createdSubscription
  }

  if (localSubscription.asaas_subscription_id && ['scheduled', 'active'].includes(localSubscription.status)) {
    return NextResponse.json({ success: true, subscription: localSubscription })
  }

  const apiKey = process.env.ASAAS_API_KEY
  if (!apiKey) {
    console.error('[Platform Subscription] Payment provider is not configured.')
    return NextResponse.json({ error: 'Pagamento temporariamente indisponível.' }, { status: 503 })
  }

  const customer = await createCustomer({
    name,
    email,
    cpfCnpj,
    mobilePhone: phone,
    externalReference: userId,
    notificationDisabled: true,
  }, apiKey)

  const trialEndsAt = localSubscription.trial_ends_at as string | null
  const nextDueDate = isoDate(isFuture(trialEndsAt) ? trialEndsAt : new Date().toISOString())

  // ── Referral split: 20% to referrer's Asaas wallet ──
  let split: Array<{ walletId: string; percentualValue: number }> | undefined
  try {
    const { data: subscriberProfile } = await admin
      .from('profiles')
      .select('referred_by')
      .eq('id', userId)
      .maybeSingle()

    if (subscriberProfile?.referred_by) {
      const { data: referrer } = await admin
        .from('profiles')
        .select('id, full_name, email, document_number, asaas_wallet_id, asaas_account_id')
        .eq('id', subscriberProfile.referred_by)
        .maybeSingle()

      if (referrer) {
        let walletId = referrer.asaas_wallet_id

        // Create subaccount if referrer doesn't have one
        if (!walletId && referrer.email && referrer.document_number) {
          try {
            const subaccount = await createSubaccount({
              name: referrer.full_name || referrer.email,
              email: referrer.email,
              cpfCnpj: referrer.document_number.replace(/\D/g, ''),
            })
            walletId = subaccount.walletId
            // Save wallet and account IDs
            await admin
              .from('profiles')
              .update({
                asaas_wallet_id: walletId,
                asaas_account_id: subaccount.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', referrer.id)
          } catch (subaccountError) {
            console.error('[Platform Subscription] Failed to create referrer subaccount:', subaccountError)
          }
        }

        if (walletId) {
          split = [
            { walletId, percentualValue: 20 },
          ]
        }
      }
    }
  } catch (splitError) {
    console.error('[Platform Subscription] Split lookup error (non-blocking):', splitError)
  }

  const asaasSubscription = await createCreditCardSubscription({
    customer: customer.id,
    billingType: 'CREDIT_CARD',
    value: FLOWYN_PRO_PRICE,
    nextDueDate,
    cycle: 'MONTHLY',
    description: 'Flowyn Pro - mensalidade sem taxa por venda',
    externalReference: String(localSubscription.id),
    creditCard: {
      holderName: String(body.card?.holderName || name).trim(),
      number: cardNumber,
      expiryMonth: cardExpiryMonth,
      expiryYear: cardExpiryYear,
      ccv: cardCcv,
    },
    creditCardHolderInfo: {
      name,
      email,
      cpfCnpj,
      postalCode,
      addressNumber,
      addressComplement: String(body.addressComplement || '').trim() || null,
      mobilePhone: phone,
    },
    remoteIp: getClientIp(req),
    ...(split ? { split } : {}),
  }, apiKey)

  const nextStatus = isFuture(trialEndsAt) ? 'scheduled' : 'active'
  const { data: updatedSubscription, error: updateError } = await admin
    .from('platform_subscriptions')
    .update({
      asaas_customer_id: customer.id,
      asaas_subscription_id: asaasSubscription.id,
      status: nextStatus,
      last_payment_status: asaasSubscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', localSubscription.id)
    .select('id, user_id, status, asaas_customer_id, asaas_subscription_id, trial_ends_at, current_period_ends_at, last_payment_status')
    .single()

  if (updateError || !updatedSubscription) {
    return NextResponse.json({ error: 'Assinatura criada na Asaas, mas nao foi salva na Flowyn.' }, { status: 500 })
  }

  await admin
    .from('profiles')
    .update({ plan: 'pro', updated_at: new Date().toISOString() })
    .eq('id', userId)

  await admin.from('security_audit_log').insert({
    actor_user_id: userId,
    action: 'FLOWYN_PRO_SUBSCRIPTION_CREATED',
    entity_type: 'platform_subscription',
    entity_id: updatedSubscription.id,
    metadata: { asaas_subscription_id: asaasSubscription.id, next_due_date: nextDueDate },
  })

  return NextResponse.json(
    { success: true, subscription: updatedSubscription },
    { headers: { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' } },
  )
}

export async function DELETE(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin || origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Origem da requisição inválida.' }, { status: 403 })
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: subscription } = await admin
    .from('platform_subscriptions')
    .select('id, user_id, status, asaas_customer_id, asaas_subscription_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!subscription) {
    return NextResponse.json({ error: 'Assinatura nao encontrada.' }, { status: 404 })
  }

  const apiKey = process.env.ASAAS_API_KEY
  if (subscription.asaas_subscription_id && apiKey) {
    await cancelSubscription(subscription.asaas_subscription_id, apiKey)
  }

  await admin
    .from('platform_subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id)

  await admin
    .from('profiles')
    .update({ plan: 'free', updated_at: new Date().toISOString() })
    .eq('id', userId)

  await admin.from('security_audit_log').insert({
    actor_user_id: userId,
    action: 'FLOWYN_PRO_SUBSCRIPTION_CANCELLED',
    entity_type: 'platform_subscription',
    entity_id: subscription.id,
  })

  return NextResponse.json({ success: true })
}
