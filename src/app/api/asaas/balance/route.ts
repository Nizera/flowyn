import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { retrieveBalance } from '@/lib/asaas'
import { decryptApiKey } from '@/lib/encryption'

function getAdminClient() {
  return createAdminClient()
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  const { data: account, error } = await admin
    .from('payment_accounts')
    .select('api_key, wallet_id')
    .eq('user_id', user.id)
    .eq('provider', 'asaas')
    .single()

  if (error || !account?.api_key) {
    return NextResponse.json({ available: 0, pending: 0, currency: 'BRL', connected: false })
  }

  try {
    const balance = await retrieveBalance(decryptApiKey(account.api_key))
    return NextResponse.json({
      available: Number(balance.balance || 0),
      pending: 0,
      currency: 'BRL',
      connected: true,
    })
  } catch {
    console.error('[Asaas Balance] Failed to retrieve balance')
    return NextResponse.json({ error: 'Erro ao consultar saldo Asaas' }, { status: 500 })
  }
}
