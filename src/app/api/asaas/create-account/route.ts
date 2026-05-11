import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { createAsaasSubaccount, findAsaasSubaccountByEmail } from '@/lib/asaas'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { 
      name, 
      email, 
      cpfCnpj, 
      companyType, 
      phone, 
      address, 
      addressNumber, 
      complement, 
      province, 
      postalCode,
      birthDate,
      incomeValue
    } = body

    // 1. Create account in Asaas
    console.log('[Asaas] Criando subconta para:', email)
    let asaasAccount
    try {
      asaasAccount = await createAsaasSubaccount({
        name,
        email,
        cpfCnpj,
        companyType,
        phone,
        mobilePhone: phone, // Using same phone for mobile
        address,
        addressNumber,
        complement,
        province,
        postalCode,
        birthDate,
        incomeValue: Number(incomeValue)
      })
    } catch (createError: any) {
      const errorMessage = createError.message?.toLowerCase() || ''
      
      // Se o erro indicar que o email já está em uso, tentamos buscar a conta existente
      if (errorMessage.includes('em uso') || errorMessage.includes('already in use') || errorMessage.includes('invalid_email')) {
        console.log('[Asaas] Email já em uso detectado (catch). Buscando conta existente para:', email)
        const existing = await findAsaasSubaccountByEmail(email)
        
        if (existing) {
          console.log('[Asaas] Conta existente encontrada:', existing.walletId || existing.id)
          asaasAccount = existing
        } else {
          console.error('[Asaas] Erro: Email em uso, mas não encontramos a conta via busca.')
          return NextResponse.json({ 
            error: 'Este email já está sendo usado na Asaas, mas não conseguimos recuperar os dados da conta vinculada.' 
          }, { status: 400 })
        }
      } else {
        // Lança novamente se for outro erro
        throw createError
      }
    }

    const walletId = asaasAccount.walletId || asaasAccount.id // Accounts returned from list might have 'id' instead of 'walletId'


    const apiKey = asaasAccount.apiKey // We might want to store this if we ever need to act as the subaccount

    // 2. Update profile with the new wallet ID, API Key and other details
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        asaas_wallet_id: walletId,
        asaas_api_key: apiKey,
        // Also update other fields to keep them in sync
        document_number: cpfCnpj,
        phone,
        address,
        address_number: addressNumber,
        complement,
        province,
        postal_code: postalCode,
        company_type: companyType,
        birth_date: birthDate,
        income_value: Number(incomeValue),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)



    if (updateError) {
      console.error('[Asaas] Erro ao atualizar perfil:', updateError)
      return NextResponse.json({ 
        error: `Conta criada na Asaas (${walletId}), mas erro ao salvar no banco: ${updateError.message}` 
      }, { status: 500 })
    }


    return NextResponse.json({ 
      success: true, 
      wallet_id: walletId 
    })

  } catch (error: any) {
    console.error('[Asaas] Erro na criação de conta:', error)
    return NextResponse.json({ 
      error: error.message || 'Erro interno ao criar conta Asaas' 
    }, { status: 400 })
  }
}
