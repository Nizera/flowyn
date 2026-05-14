import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe, calculateSplit } from '@/lib/stripe'
import { resend } from '@/lib/resend'
import { deliveryEmail } from '@/lib/email-templates'

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: any

  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET)
  } catch (err: any) {
    console.error(`[Webhook Error]: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  const supabase = getAdminClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const metadata = session.metadata

    console.log('[Webhook] Checkout concluído:', session.id)

    const orderId = metadata.order_id
    const producerId = metadata.producer_id
    const affiliateId = metadata.affiliate_id
    const commissionRate = Number(metadata.commission_rate || 0)
    const amountInCents = session.amount_total

    // 1. Calcular Splits
    const { platformFee, affiliateShare, producerShare } = calculateSplit(amountInCents, commissionRate)

    try {
      // 2. Buscar IDs das contas Stripe Connect
      const { data: producerProfile } = await supabase
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', producerId)
        .single()

      let affiliateAccountId = null
      if (affiliateId) {
        const { data: affiliateProfile } = await supabase
          .from('profiles')
          .select('stripe_account_id')
          .eq('id', affiliateId)
          .single()
        affiliateAccountId = affiliateProfile?.stripe_account_id
      }

      // 3. Executar Transferências (Split)
      if (producerProfile?.stripe_account_id) {
        await stripe.transfers.create({
          amount: producerShare,
          currency: 'brl',
          destination: producerProfile.stripe_account_id,
          transfer_group: orderId,
          metadata: { order_id: orderId, type: 'producer_payout' }
        })
      }

      if (affiliateAccountId && affiliateShare > 0) {
        await stripe.transfers.create({
          amount: affiliateShare,
          currency: 'brl',
          destination: affiliateAccountId,
          transfer_group: orderId,
          metadata: { order_id: orderId, type: 'affiliate_payout' }
        })
      }

      // 4. Atualizar Ordem no Banco
      await supabase
        .from('orders')
        .update({
          status: 'paid',
          commission_amount: affiliateShare / 100,
          platform_fee: platformFee / 100,
          producer_amount: producerShare / 100,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)

      // 5. Buscar dados do pedido + produto para entrega
      const { data: orderData } = await supabase
        .from('orders')
        .select(`
          *,
          product:products(
            id, name, delivery_type, delivery_url, deliverable_file_path, webhook_url
          )
        `)
        .eq('id', orderId)
        .single()

      if (!orderData) {
        console.error('[Webhook] Order not found after update:', orderId)
        return NextResponse.json({ received: true })
      }

      const product = orderData.product as any

      // 6. Entrega Digital: enviar e-mail com arquivo ou link
      if (product?.delivery_type === 'external') {
        let accessLink: string | null = product.delivery_url || null
        let isFile = false

        // Se tem arquivo no Storage → gerar signed URL válido por 48h
        if (product.deliverable_file_path) {
          console.log('[Webhook] Gerando signed URL para:', product.deliverable_file_path)
          const { data: signed, error: signedError } = await supabase.storage
            .from('product-files')
            .createSignedUrl(product.deliverable_file_path, 60 * 60 * 48) // 48h

          if (signedError) {
            console.error('[Webhook] Erro ao gerar signed URL:', signedError)
          } else {
            accessLink = signed?.signedUrl || accessLink
            isFile = true
          }
        }

        // Enviar e-mail transacional
        if (process.env.RESEND_API_KEY) {
          const emailResult = await resend.emails.send({
            from: 'Flowyn <noreply@flowyn.com.br>',
            to: orderData.customer_email,
            subject: `✅ Seu acesso a "${product.name}" está pronto!`,
            html: deliveryEmail({
              customerName: orderData.customer_name,
              productName: product.name,
              accessLink,
              isFile,
            }),
          })
          console.log('[Webhook] E-mail enviado:', emailResult)
        } else {
          console.warn('[Webhook] RESEND_API_KEY não configurada — e-mail não enviado para:', orderData.customer_email)
        }
      }

      // 7. Webhook Externo do Produtor (se configurado)
      if (product?.webhook_url) {
        console.log('[Webhook] Disparando webhook externo para:', product.webhook_url)
        fetch(product.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'purchase.completed', data: orderData })
        }).catch(err => console.error('[External Webhook Error]:', err))
      }

    } catch (dbError: any) {
      console.error('[Webhook DB/Stripe Error]:', dbError)
      return new Response(`Error: ${dbError.message}`, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
