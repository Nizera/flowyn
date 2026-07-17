import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createSubaccount, listSubaccounts, onlyDigits, retrieveSubaccount, retrieveAccountInfo, retrieveWalletId } from '@/lib/asaas'
import { isValidCpfCnpj, isValidEmail, isValidPhone } from '@/lib/validation'
import { hashIdentifier } from '@/lib/hash'
import { encryptApiKey, decryptApiKey } from '@/lib/encryption'

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
    .select('provider_account_id, wallet_id, api_key, status, connection_mode')
    .eq('user_id', user.id)
    .eq('provider', 'asaas')
    .single()

  const connectionMode = paymentAccount?.connection_mode || 'subaccount'
  const isConnected = connectionMode === 'standalone'
    ? Boolean(paymentAccount?.status === 'connected')
    : Boolean(paymentAccount?.wallet_id || (profile as Profile).asaas_wallet_id)

  // Auto-fetch walletId for standalone connections that are missing it
  if (connectionMode === 'standalone' && isConnected && !paymentAccount?.wallet_id && !(profile as Profile).asaas_wallet_id) {
    console.log('[Asaas Account] Auto-fetching walletId for standalone connection')
    try {
      const decryptedKey = decryptApiKey(paymentAccount!.api_key!)
      const walletId = await retrieveWalletId(decryptedKey)
      console.log('[Asaas Account] walletId from API:', walletId)
      if (walletId) {
        await admin
          .from('payment_accounts')
          .update({ wallet_id: walletId, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('provider', 'asaas')
        await admin
          .from('profiles')
          .update({ asaas_wallet_id: walletId, updated_at: new Date().toISOString() })
          .eq('id', user.id)
        ;(paymentAccount as Record<string, unknown>).wallet_id = walletId
        console.log('[Asaas Account] walletId saved successfully')
      } else {
        console.warn('[Asaas Account] No walletId returned from API')
      }
    } catch (err) {
      console.error('[Asaas Account] Auto-fetch walletId failed:', err)
    }
  }

  let remoteAccount = null
  if (connectionMode === 'subaccount') {
    const accountId = paymentAccount?.provider_account_id || (profile as Profile).asaas_account_id
    if (accountId) {
      try {
        remoteAccount = await retrieveSubaccount(accountId)
      } catch (err) {
        console.warn('[Asaas Account] Could not retrieve subaccount:', err)
      }
    }
  }

  return NextResponse.json({
    connected: isConnected,
    connectionMode,
    email: user.email,
    profile: {
      ...profile,
      asaas_account_id: paymentAccount?.provider_account_id || (profile as Profile).asaas_account_id,
      asaas_wallet_id: paymentAccount?.wallet_id || (profile as Profile).asaas_wallet_id,
      asaas_account_status: paymentAccount?.status || (profile as Profile).asaas_account_status,
    },
    remoteAccount: remoteAccount
      ? { id: remoteAccount.id, name: remoteAccount.name, email: remoteAccount.email, walletId: remoteAccount.walletId ?? null }
      : null,
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  const { data: withinRateLimit, error: rateLimitError } = await admin.rpc('consume_rate_limit', {
    requested_bucket: 'asaas-account',
    requested_identifier_hash: await hashIdentifier(user.id),
    max_requests: 10,
    window_seconds: 900,
  })

  if (rateLimitError) {
    console.error('[Asaas Account] Rate limiter unavailable.')
    return NextResponse.json({ error: 'Cadastro Asaas temporariamente indisponivel.' }, { status: 503 })
  }

  if (!withinRateLimit) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, { status: 429 })
  }

  const body = await request.json()

  // ── Standalone mode: producer provides their own Asaas API key ──
  if (body.mode === 'standalone' && body.api_key) {
    const apiKey = String(body.api_key).trim()
    if (!apiKey || apiKey.length < 20 || apiKey.length > 200) {
      return NextResponse.json({ error: 'Informe uma API key valida.' }, { status: 400 })
    }

    let accountInfo
    try {
      accountInfo = await retrieveAccountInfo(apiKey)
    } catch {
      return NextResponse.json({ error: 'API key invalida ou sem acesso. Verifique no painel Asaas.' }, { status: 400 })
    }

    const walletId = await retrieveWalletId(apiKey)

    await admin
      .from('profiles')
      .update({
        asaas_account_id: accountInfo.id || null,
        asaas_wallet_id: walletId,
        asaas_account_status: 'connected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    await admin
      .from('payment_accounts')
      .upsert({
        user_id: user.id,
        provider: 'asaas',
        provider_account_id: accountInfo.id || null,
        wallet_id: walletId,
        api_key: encryptApiKey(apiKey),
        status: 'connected',
        connection_mode: 'standalone',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    await admin.from('security_audit_log').insert({
      actor_user_id: user.id,
      action: 'ASAAS_STANDALONE_CONNECTED',
      entity_type: 'payment_account',
      entity_id: user.id,
      metadata: { provider: 'asaas' },
    })

    return NextResponse.json({
      connected: true,
      connectionMode: 'standalone',
      message: 'Conta Asaas vinculada com sucesso.',
    })
  }

  // ── Subaccount mode: create or link a subaccount under Flowyn ──
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
  const documentType = payload.cpfCnpj.length === 11 ? 'CPF' : payload.cpfCnpj.length === 14 ? 'CNPJ' : null
  const subaccountPayload = documentType === 'CPF'
    ? { ...payload, companyType: undefined }
    : payload
  let newSubaccountApiKey: string | null = null

  if (!payload.name || !payload.email || !payload.cpfCnpj || !payload.mobilePhone || !payload.postalCode || !payload.addressNumber || !payload.incomeValue) {
    return NextResponse.json({ error: 'Preencha nome, e-mail, CPF/CNPJ, celular, CEP, número e faturamento mensal.' }, { status: 400 })
  }

  if (!isValidEmail(payload.email) || !isValidCpfCnpj(payload.cpfCnpj) || !isValidPhone(payload.mobilePhone)) {
    return NextResponse.json({ error: 'Informe e-mail, CPF/CNPJ e celular válidos.' }, { status: 400 })
  }

  if (!documentType) {
    return NextResponse.json({ error: 'Informe um CPF com 11 digitos ou CNPJ com 14 digitos.' }, { status: 400 })
  }

  const { data: currentProfile } = await admin
    .from('profiles')
    .select('asaas_account_id, asaas_wallet_id, asaas_account_status')
    .eq('id', user.id)
    .single()

  const { data: currentPaymentAccount } = await admin
    .from('payment_accounts')
    .select('provider_account_id, wallet_id, api_key, status, connection_mode')
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

  if (existingAccountId && existingWalletId && currentPaymentAccount?.connection_mode !== 'standalone') {
    let remoteAccount = null
    try {
      remoteAccount = await retrieveSubaccount(existingAccountId)
    } catch (err) {
      console.warn('[Asaas Account] Existing subaccount lookup failed — account may be from sandbox:', err)
    }

    if (!remoteAccount) {
      // Mark all pending orders as failed (producer disconnected Asaas)
      const { data: producerProducts } = await admin
        .from('products')
        .select('id')
        .eq('owner_id', user.id)
      const producerProductIds = (producerProducts || []).map((p: { id: string }) => p.id)

      if (producerProductIds.length > 0) {
        await admin
          .from('orders')
          .update({ status: 'failed', asaas_status: 'PRODUCER_DISCONNECTED', updated_at: new Date().toISOString() })
          .in('product_id', producerProductIds)
          .eq('status', 'pending')
      }

      await admin.from('payment_accounts').delete().eq('user_id', user.id).eq('provider', 'asaas')
      await admin.from('profiles').update({
        asaas_account_id: null,
        asaas_wallet_id: null,
        asaas_account_status: 'disconnected',
      }).eq('id', user.id)

      return NextResponse.json({
        connected: false,
        error: 'A subconta Asaas anterior nao foi encontrada no ambiente de producao. Reconecte a conta Asaas para gerar uma nova subconta.',
      }, { status: 409 })
    }

    const walletId = remoteAccount.walletId

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
        connection_mode: 'subaccount',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    await admin.from('security_audit_log').insert({
      actor_user_id: user.id,
      action: 'ASAAS_ACCOUNT_UPDATED',
      entity_type: 'payment_account',
      entity_id: user.id,
      metadata: { provider: 'asaas', document_type: documentType },
    })

    return NextResponse.json({
      connected: true,
      updated: true,
      connectionMode: 'subaccount',
      walletId,
      message: 'Cadastro local atualizado. Wallet Asaas existente preservado.',
    })
  }

  try {
    let account = null

    if (documentType === 'CPF') {
      const existingAccounts = await listSubaccounts({ cpfCnpj: payload.cpfCnpj })
      account = existingAccounts.data?.find(item => onlyDigits(item.cpfCnpj) === payload.cpfCnpj) || null
    }

    if (!account) {
      try {
        account = await createSubaccount(subaccountPayload)
        newSubaccountApiKey = account.apiKey
      } catch (createErr: unknown) {
        const msg = String((createErr as Error)?.message || createErr || '')
        if (msg.includes('já está em uso') || msg.toLowerCase().includes('already in use')) {
          const fallbackEmail = `flowyn+${payload.cpfCnpj}@${payload.email.split('@')[1]}`
          account = await createSubaccount({ ...subaccountPayload, email: fallbackEmail })
          newSubaccountApiKey = account.apiKey
        } else {
          throw createErr
        }
      }
    }

    if (!account.walletId) {
      return NextResponse.json({
        error: 'Subconta Asaas encontrada/criada, mas sem Wallet ID retornado. Verifique o cadastro no painel Asaas.',
      }, { status: 409 })
    }

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
        api_key: newSubaccountApiKey ? encryptApiKey(newSubaccountApiKey) : null,
        status: 'connected',
        connection_mode: 'subaccount',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    await admin.from('security_audit_log').insert({
      actor_user_id: user.id,
      action: newSubaccountApiKey ? 'ASAAS_ACCOUNT_CREATED' : 'ASAAS_ACCOUNT_LINKED',
      entity_type: 'payment_account',
      entity_id: user.id,
      metadata: { provider: 'asaas', document_type: documentType },
    })

    return NextResponse.json({
      connected: true,
      created: true,
      connectionMode: 'subaccount',
      accountId: account.id,
      walletId: account.walletId,
    })
  } catch (err: unknown) {
    console.error('[Asaas Account] Error:', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Erro ao configurar conta de pagamento. Tente novamente.' }, { status: 500 })
  }
}
