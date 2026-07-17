import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createTransfer } from '@/lib/asaas'
import { hashIdentifier } from '@/lib/hash'

const MIN_WITHDRAWAL = 10

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') || '127.0.0.1'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const admin = createAdminClient()

  // Rate limit: financial operation
  const clientIp = getClientIp(req)
  const { data: withinRateLimit, error: rateLimitError } = await admin.rpc('consume_rate_limit', {
    requested_bucket: 'referral-withdraw',
    requested_identifier_hash: await hashIdentifier(clientIp),
    max_requests: 3,
    window_seconds: 60 * 60,
  })
  if (rateLimitError || !withinRateLimit) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em 1 hora.' }, { status: 429 })
  }

  // Get referrer profile (single query)
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, document_number, referral_code')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  if (!profile?.referral_code) {
    return NextResponse.json({ error: 'Você não tem código de indicação.' }, { status: 400 })
  }

  // Find pending commissions
  const { data: referrals } = await admin
    .from('referrals')
    .select('id')
    .eq('referrer_id', user.id)

  const referralIds = referrals?.map(r => r.id) ?? []
  if (referralIds.length === 0) {
    return NextResponse.json({ error: 'Nenhuma indicação registrada.' }, { status: 400 })
  }

  const { data: pendingCommissions } = await admin
    .from('referral_commissions')
    .select('id, amount')
    .in('referral_id', referralIds)
    .eq('status', 'pending')

  if (!pendingCommissions || pendingCommissions.length === 0) {
    return NextResponse.json({ error: 'Nenhuma comissão pendente para saque.' }, { status: 400 })
  }

  const totalPending = pendingCommissions.reduce((sum, c) => sum + Number(c.amount), 0)
  if (totalPending < MIN_WITHDRAWAL) {
    return NextResponse.json({ error: `Valor mínimo para saque: R$ ${MIN_WITHDRAWAL},00.` }, { status: 400 })
  }

  // Need CPF/CNPJ for Pix transfer
  const documentNumber = profile.document_number?.replace(/\D/g, '')
  if (!documentNumber || documentNumber.length < 11) {
    return NextResponse.json({ error: 'CPF/CNPJ não encontrado no perfil. Atualize seus dados em Minha Conta.' }, { status: 400 })
  }

  // Atomically mark commissions as 'withdrawing' to prevent double withdrawal
  const commissionIds = pendingCommissions.map(c => c.id)
  const { data: lockedCommissions, error: lockError } = await admin
    .from('referral_commissions')
    .update({ status: 'withdrawing' })
    .in('id', commissionIds)
    .eq('status', 'pending')
    .select('id, amount')

  if (lockError || !lockedCommissions || lockedCommissions.length === 0) {
    return NextResponse.json({ error: 'Não foi possível processar o saque. Tente novamente.' }, { status: 409 })
  }

  // Use only the commissions we actually locked (handles partial lock)
  const lockedIds = lockedCommissions.map(c => c.id)
  const lockedTotal = lockedCommissions.reduce((sum, c) => sum + Number(c.amount), 0)

  // Get platform API key for Asaas transfers
  const platformApiKey = process.env.ASAAS_API_KEY
  if (!platformApiKey) {
    // Rollback: revert locked commissions to pending
    await admin
      .from('referral_commissions')
      .update({ status: 'pending' })
      .in('id', lockedIds)
    return NextResponse.json({ error: 'Sistema de pagamento indisponível.' }, { status: 500 })
  }

  try {
    const transfer = await createTransfer({
      value: lockedTotal,
      pixAddressKey: documentNumber,
      pixAddressKeyType: documentNumber.length === 11 ? 'CPF' : 'CNPJ',
      description: `Comissão indicação Flowyn - ${profile.full_name || user.id}`,
      externalReference: `ref-${crypto.randomUUID()}`,
    }, platformApiKey)

    // Mark commissions as paid
    await admin
      .from('referral_commissions')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .in('id', lockedIds)
      .eq('status', 'withdrawing')

    // Audit log
    await admin.from('security_audit_log').insert({
      actor_user_id: user.id,
      action: 'REFERRAL_COMMISSION_WITHDRAWAL',
      entity_type: 'referral_commission',
      entity_id: user.id,
      metadata: {
        amount: lockedTotal,
        commission_count: lockedIds.length,
        transfer_id: transfer.id,
      },
    })

    return NextResponse.json({
      success: true,
      amount: lockedTotal,
      transfer_id: transfer.id,
    })
  } catch (transferError) {
    console.error('[Referral] Transfer error:', transferError)
    // Rollback: revert locked commissions to pending
    await admin
      .from('referral_commissions')
      .update({ status: 'pending' })
      .in('id', lockedIds)
      .eq('status', 'withdrawing')
    return NextResponse.json({ error: 'Falha na transferência. Tente novamente.' }, { status: 500 })
  }
}
