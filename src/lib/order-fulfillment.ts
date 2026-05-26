import { getResendClient } from '@/lib/resend'
import { deliveryEmail } from '@/lib/email-templates'
import { dispatchWebhook } from '@/lib/webhook'

type SupabaseAdmin = any

export async function fulfillPaidOrder(supabase: SupabaseAdmin, orderId: string, providerStatus?: string) {
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .single()

  if (!existingOrder || existingOrder.status === 'paid') {
    return { skipped: true }
  }

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      asaas_status: providerStatus || null,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .neq('status', 'paid')
    .select(`
      *,
      product:products(
        id, name, delivery_type, delivery_url, deliverable_file_paths, order_bump_file_paths, webhook_url
      )
    `)
    .single()

  if (orderError || !orderData) {
    return { skipped: true, error: orderError?.message }
  }

  const product = orderData.product as any

  if (product?.delivery_type === 'external') {
    const accessLinks: { label: string; url: string; isFile: boolean }[] = []

    if (product.delivery_url) {
      accessLinks.push({ label: 'Acessar Conteudo', url: product.delivery_url, isFile: false })
    }

    if (Array.isArray(product.deliverable_file_paths)) {
      for (const path of product.deliverable_file_paths) {
        const { data: signed } = await supabase.storage
          .from('product-files')
          .createSignedUrl(path, 60 * 60 * 48)

        if (signed?.signedUrl) {
          accessLinks.push({ label: path.split('/').pop() || 'Baixar Arquivo', url: signed.signedUrl, isFile: true })
        }
      }
    }

    if (orderData.includes_order_bump && Array.isArray(product.order_bump_file_paths)) {
      for (const path of product.order_bump_file_paths) {
        const { data: signed } = await supabase.storage
          .from('product-files')
          .createSignedUrl(path, 60 * 60 * 48)

        if (signed?.signedUrl) {
          accessLinks.push({ label: path.split('/').pop() || 'Baixar Order Bump', url: signed.signedUrl, isFile: true })
        }
      }
    }

    const resendClient = getResendClient()
    if (resendClient) {
      await resendClient.emails.send({
        from: 'Flowyn <noreply@flowyn.com.br>',
        to: orderData.customer_email,
        subject: `Seu acesso a "${product.name}" esta pronto!`,
        html: deliveryEmail({
          customerName: orderData.customer_name,
          productName: product.name,
          accessLinks,
        }),
      })
    }
  }

  dispatchWebhook(orderId).catch(err => console.error('[Order Fulfillment Webhook Error]:', err))

  return { skipped: false }
}
