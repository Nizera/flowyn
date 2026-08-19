import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createPixPayment, getPixQrCode } from '@/lib/asaas'

export const dynamic = 'force-dynamic'

// POST /api/wa/pix - Gerar PIX para pagamento via WhatsApp
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { session_id, chat_jid, value, description, product_id, plan_id } = body

    if (!session_id || !chat_jid || !value) {
      return NextResponse.json(
        { error: 'session_id, chat_jid, and value are required' },
        { status: 400 }
      )
    }

    // Verificar se a sessão existe e pertence ao usuário
    const { data: session, error: sessionError } = await supabase
      .from('wa_sessions')
      .select('id, status')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Buscar API key do Asaas do produtor
    const { data: paymentAccount } = await supabase
      .from('payment_accounts')
      .select('api_key, provider_account_id, wallet_id')
      .eq('user_id', user.id)
      .eq('provider', 'asaas')
      .single()

    if (!paymentAccount?.api_key) {
      return NextResponse.json(
        { error: 'Asaas not configured' },
        { status: 400 }
      )
    }

    // Buscar ou criar cliente no Asaas para o contato
    const { data: contact } = await supabase
      .from('wa_contacts')
      .select('phone, name, email')
      .eq('user_id', user.id)
      .eq('phone', chat_jid.replace('@s.whatsapp.net', '').replace('@g.us', ''))
      .single()

    const phone = contact?.phone || chat_jid.split('@')[0].replace('+', '')
    const customerName = contact?.name || `Contato ${phone}`
    const customerEmail = contact?.email || `${phone}@placeholder.com`

    // Criar cliente no Asaas (ou buscar existente)
    let customerId: string | null = null

    // Buscar cliente existente pelo email (não usar phone como CPF/CNPJ)
    const searchResponse = await fetch(
      `${process.env.ASAAS_API_URL || 'https://api-sandbox.asaas.com/v3'}/customers?email=${encodeURIComponent(customerEmail)}`,
      {
        headers: {
          access_token: paymentAccount.api_key,
          accept: 'application/json',
        },
      }
    )

    if (searchResponse.ok) {
      const searchData = await searchResponse.json()
      if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id
      }
    }

    // Se não existe, criar sem cpfCnpj (Asaas aceita clientes sem CPF/CNPJ)
    if (!customerId) {
      const createResponse = await fetch(
        `${process.env.ASAAS_API_URL || 'https://api-sandbox.asaas.com/v3'}/customers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            access_token: paymentAccount.api_key,
            accept: 'application/json',
          },
          body: JSON.stringify({
            name: customerName,
            email: customerEmail,
            phone: phone,
            mobilePhone: phone,
            notificationDisabled: true,
          }),
        }
      )

      if (createResponse.ok) {
        const createData = await createResponse.json()
        customerId = createData.id
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Failed to create customer' },
        { status: 500 }
      )
    }

    // Criar pagamento PIX
    const externalReference = `wa_${session_id}_${chat_jid}_${Date.now()}`
    const dueDate = new Date().toISOString().split('T')[0]

    const payment = await createPixPayment(
      {
        customer: customerId,
        billingType: 'PIX',
        value: parseFloat(value),
        dueDate,
        description: description || `Pagamento via WhatsApp`,
        externalReference,
        split: paymentAccount.wallet_id
          ? [{ walletId: paymentAccount.wallet_id, percentualValue: 100 }]
          : undefined,
      },
      paymentAccount.api_key
    )

    if (!payment.id) {
      return NextResponse.json(
        { error: 'Failed to create PIX payment' },
        { status: 500 }
      )
    }

    // Buscar QR Code do PIX
    const qrCode = await getPixQrCode(payment.id, paymentAccount.api_key)

    // Salvar registro do pagamento
    await supabase.from('wa_pix_payments').insert({
      id: payment.id,
      session_id,
      chat_jid,
      user_id: user.id,
      value: parseFloat(value),
      status: 'pending',
      external_reference: externalReference,
      product_id: product_id || null,
      plan_id: plan_id || null,
    })

    return NextResponse.json({
      payment_id: payment.id,
      status: payment.status,
      value: payment.value,
      pix_qr_code: qrCode.encodedImage,
      pix_copy_paste: qrCode.payload,
      expiration_date: qrCode.expirationDate,
      invoice_url: payment.invoiceUrl,
    })
  } catch (error) {
    console.error('[WA PIX] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create PIX payment' },
      { status: 500 }
    )
  }
}
