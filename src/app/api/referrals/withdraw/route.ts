import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createTransfer } from '@/lib/asaas'
import { decryptApiKey } from '@/lib/encryption'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const admin = createAdminClient()

  // Get referrer profile
  const { data: profile } = await admin
    .from('profiles')
    .select('id, document_number, asaas_wallet_id, asaas_api_key, asaas_account_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  // Get referral code
  const { data: referral } = await admin
    .from('profiles')
    .select('referral_code')
    .eq('id', user.id)
    .maybeSingle()

  if (!referral?.referral_code) {
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
  if (totalPending <= 0) {
    return NextResponse.json({ error: 'Valor insuficiente para saque.' }, { status: 400 })
  }

  // Need CPF/CNPJ for Pix transfer
  const documentNumber = profile.document_number?.replace(/\D/g, '')
  if (!documentNumber || documentNumber.length < 11) {
    return NextResponse.json({ error: 'CPF/CNPJ não encontrado no perfil. Atualize seus dados em Minha Conta.' }, { status: 400 })
  }

  // Get platform API key for Asaas transfers
  const platformApiKey = process.env.ASAAS_API_KEY
  if (!platformApiKey) {
    return NextResponse.json({ error: 'Sistema de pagamento indisponível.' }, { status: 500 })
  }

  try {
    // Transfer via Pix using CPF as key
    const transfer = await createTransfer({
      value: totalPending,
      pixAddressKey: documentNumber,
      pixAddressKeyType: documentNumber.length === 11 ? 'CPF' : 'CNPJ',
      description: `Comissão de indicação - Flowyn`,
      externalReference: `referral-withdrawal-${user.id}-${Date.now()}`,
    }, platformApiKey)

    // Mark commissions as paid
    const commissionIds = pendingCommissions.map(c => c.id)
    await admin
      .from('referral_commissions')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .in('id', commissionIds)

    // Audit log
    await admin.from('security_audit_log').insert({
      actor_user_id: user.id,
      action: 'REFERRAL_COMMISSION_WITHDRAWAL',
      entity_type: 'referral_commission',
      entity_id: user.id,
      metadata: {
        amount: totalPending,
        commission_count: commissionIds.length,
        transfer_id: transfer.id,
      },
    })

    return NextResponse.json({
      success: true,
      amount: totalPending,
      transfer_id: transfer.id,
    })
  } catch (transferError) {
    console.error('[Referral] Transfer error:', transferError)
    const message = transferError instanceof Error ? transferError.message : 'Erro ao transferir.'
    return NextResponse.json({ error: `Falha na transferência: ${message}` }, { status: 500 })
  }
}
