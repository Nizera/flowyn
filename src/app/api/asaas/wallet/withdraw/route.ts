import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { asaasRequest } from '@/lib/asaas'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { value, pixKey, pixKeyType } = await request.json()

    if (!value || !pixKey || !pixKeyType) {
      return NextResponse.json({ error: 'Parâmetros inválidos. Necessário: value, pixKey, pixKeyType' }, { status: 400 })
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

    // Criar a transferência na Asaas
    const transferResponse = await asaasRequest('/transfers', {
      method: 'POST',
      headers: {
        'access_token': profile.asaas_api_key
      },
      body: JSON.stringify({
        value: Number(value),
        pixAddressKey: pixKey,
        pixAddressKeyType: pixKeyType,
        operationType: 'PIX',
        description: 'Saque Flowyn'
      })
    })

    return NextResponse.json({ success: true, transfer: transferResponse })
  } catch (error: any) {
    console.error('[Wallet] Erro ao solicitar saque:', error)
    return NextResponse.json({ error: error.message || 'Erro interno ao processar o saque' }, { status: 500 })
  }
}
