import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { asaasRequest } from '@/lib/asaas'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar a API Key da Asaas do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('asaas_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.asaas_api_key) {
      return NextResponse.json({ error: 'API Key da Asaas não encontrada. Você precisa concluir o Onboarding primeiro.' }, { status: 400 })
    }

    // Buscar o saldo na Asaas usando a API Key da Subconta
    const balanceResponse = await asaasRequest('/finance/balance', {
      headers: {
        'access_token': profile.asaas_api_key
      }
    })

    return NextResponse.json({ balance: balanceResponse.balance })
  } catch (error: any) {
    console.error('[Wallet] Erro ao buscar saldo:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
