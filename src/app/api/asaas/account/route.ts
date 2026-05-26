import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createSubaccount, onlyDigits, retrieveSubaccount } from '@/lib/asaas'

type Profile = {
  asaas_account_id: string | null
  asaas_wallet_id: string | null
  asaas_account_status: string | null
  full_name: string | null
  document_number: string | null
  phone: string | null
  asaas_company_type: string | null
  asaas_birth_date: string | null
  asaas_income_value: number | null
  asaas_address: string | null
  asaas_address_number: string | null
  asaas_complement: string | null
  asaas_province: string | null
  asaas_postal_code: string | null
}

function getAdminClient() {
  return createAdminClient()
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      asaas_account_id,
      asaas_wallet_id,
      asaas_account_status,
      full_name,
      document_number,
      phone,
      asaas_company_type,
      asaas_birth_date,
      asaas_income_value,
      asaas_address,
      asaas_address_number,
      asaas_complement,
      asaas_province,
      asaas_postal_code
    `)
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  }

  const admin = getAdminClient()
  const { data: paymentAccount } = await admin
    .from('payment_accounts')
    .select('provider_account_id, wallet_id, status')
    .eq('user_id', user.id)
    .eq('provider', 'asaas')
    .single()

  let remoteAccount = null
  const accountId = paymentAccount?.provider_account_id || (profile as Profile).asaas_account_id
  if (accountId) {
    try {
      remoteAccount = await retrieveSubaccount(accountId)
    } catch (err) {
      console.warn('[Asaas Account] Could not retrieve subaccount:', err)
    }
  }

  return NextResponse.json({
    connected: Boolean(paymentAccount?.wallet_id || (profile as Profile).asaas_wallet_id),
    email: user.email,
    profile: {
      ...profile,
      asaas_account_id: accountId || (profile as Profile).asaas_account_id,
      asaas_wallet_id: paymentAccount?.wallet_id || (profile as Profile).asaas_wallet_id,
      asaas_account_status: paymentAccount?.status || (profile as Profile).asaas_account_status,
    },
    remoteAccount,
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const payload = {
    name: String(body.name || '').trim(),
    email: String(body.email || user.email || '').trim(),
    cpfCnpj: onlyDigits(body.cpfCnpj),
    birthDate: body.birthDate || undefined,
    companyType: body.companyType || undefined,
    phone: onlyDigits(body.phone),
    mobilePhone: onlyDigits(body.mobilePhone || body.phone),
    address: String(body.address || '').trim(),
    addressNumber: String(body.addressNumber || '').trim(),
    complement: String(body.complement || '').trim() || undefined,
    province: String(body.province || '').trim(),
    postalCode: onlyDigits(body.postalCode),
    incomeValue: Number(body.incomeValue || 0),
  }

  if (!payload.name || !payload.email || !payload.cpfCnpj || !payload.mobilePhone || !payload.postalCode || !payload.addressNumber || !payload.incomeValue) {
    return NextResponse.json({ error: 'Preencha nome, e-mail, CPF/CNPJ, celular, CEP, número e faturamento mensal.' }, { status: 400 })
  }

  const admin = getAdminClient()
  const { data: currentProfile } = await admin
    .from('profiles')
    .select('asaas_account_id, asaas_wallet_id, asaas_account_status')
    .eq('id', user.id)
    .single()

  const { data: currentPaymentAccount } = await admin
    .from('payment_accounts')
    .select('provider_account_id, wallet_id, api_key, status')
    .eq('user_id', user.id)
    .eq('provider', 'asaas')
    .single()

  const localUpdate = {
    full_name: payload.name,
    document_number: payload.cpfCnpj,
    phone: payload.mobilePhone,
    asaas_company_type: payload.companyType || null,
    asaas_birth_date: payload.birthDate || null,
    asaas_income_value: payload.incomeValue,
    asaas_address: payload.address || null,
    asaas_address_number: payload.addressNumber,
    asaas_complement: payload.complement || null,
    asaas_province: payload.province || null,
    asaas_postal_code: payload.postalCode,
    updated_at: new Date().toISOString(),
  }

  const existingAccountId = currentPaymentAccount?.provider_account_id || (currentProfile as Profile | null)?.asaas_account_id
  const existingWalletId = currentPaymentAccount?.wallet_id || (currentProfile as Profile | null)?.asaas_wallet_id

  if (existingAccountId && existingWalletId) {
    let remoteAccount = null
    try {
      remoteAccount = await retrieveSubaccount(existingAccountId)
    } catch (err) {
      console.warn('[Asaas Account] Existing subaccount lookup failed:', err)
    }

    const walletId = remoteAccount?.walletId || existingWalletId

    await admin
      .from('profiles')
      .update({
        ...localUpdate,
        asaas_account_status: 'connected',
        asaas_account_id: existingAccountId,
        asaas_wallet_id: walletId,
      })
      .eq('id', user.id)

    await admin
      .from('payment_accounts')
      .upsert({
        user_id: user.id,
        provider: 'asaas',
        provider_account_id: existingAccountId,
        wallet_id: walletId,
        api_key: currentPaymentAccount?.api_key || null,
        status: 'connected',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    return NextResponse.json({
      connected: true,
      updated: true,
      walletId,
      message: 'Cadastro local atualizado. Wallet Asaas existente preservado.',
    })
  }

  try {
    const account = await createSubaccount(payload)

    await admin
      .from('profiles')
      .update({
        ...localUpdate,
        asaas_account_id: account.id,
        asaas_wallet_id: account.walletId,
        asaas_account_status: 'connected',
      })
      .eq('id', user.id)

    await admin
      .from('payment_accounts')
      .upsert({
        user_id: user.id,
        provider: 'asaas',
        provider_account_id: account.id,
        wallet_id: account.walletId,
        api_key: account.apiKey,
        status: 'connected',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    return NextResponse.json({
      connected: true,
      created: true,
      accountId: account.id,
      walletId: account.walletId,
    })
  } catch (err: any) {
    console.error('[Asaas Account] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao criar subconta Asaas' }, { status: 500 })
  }
}
