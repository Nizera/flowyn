import 'server-only'
import { getResendClient } from '@/lib/resend'
import { deliveryEmail, studentPasswordEmail } from '@/lib/email-templates'
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
        id, name, product_type, delivery_type, delivery_url, deliverable_file_paths, order_bump_file_paths, webhook_url
      )
    `)
    .single()

  if (orderError || !orderData) {
    return { skipped: true, error: orderError?.message }
  }

  const product = orderData.product as any
  const { data: privateCustomer } = await supabase
    .from('order_customer_private')
    .select('customer_name, customer_email')
    .eq('order_id', orderId)
    .single()

  const deliveryCustomerName = privateCustomer?.customer_name || orderData.customer_name
  const deliveryCustomerEmail = privateCustomer?.customer_email || orderData.customer_email
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

  if (product?.delivery_type === 'platform') {
    const { data: matchedUser } = await supabase
      .schema('auth')
      .from('users')
      .select('id')
      .eq('email', deliveryCustomerEmail)
      .maybeSingle()

    let studentUserId = matchedUser?.id || null
    let setupPasswordUrl: string | null = null
    if (!studentUserId) {
      const { data: createdUser } = await supabase.auth.admin.createUser({
        email: deliveryCustomerEmail,
        email_confirm: true,
        user_metadata: {
          full_name: deliveryCustomerName,
          role: 'customer',
        },
      })

      studentUserId = createdUser?.user?.id || null

      const { data: resetLink } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: deliveryCustomerEmail,
        options: {
          redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent('/reset-password?next=/learn')}`,
        },
      })

      setupPasswordUrl = resetLink?.properties?.action_link || null
    }

    const accessPayload = {
      user_id: studentUserId,
      product_id: product.id,
      order_id: orderId,
      access_email: deliveryCustomerEmail,
      granted_at: new Date().toISOString(),
    }

    if (studentUserId) {
      await supabase.from('student_access').upsert(accessPayload, { onConflict: 'user_id,product_id' })

      if (product.product_type === 'mentoria') {
        const { data: existingSessions } = await supabase
          .from('mentorship_sessions')
          .select('id')
          .eq('product_id', product.id)
          .eq('student_id', studentUserId)
          .limit(1)

        if (!existingSessions || existingSessions.length === 0) {
          const { data: templateSessions } = await supabase
            .from('mentorship_sessions')
            .select('title, description, meeting_url, sort_order')
            .eq('product_id', product.id)
            .is('student_id', null)
            .order('sort_order', { ascending: true })

          if (templateSessions?.length) {
            await supabase.from('mentorship_sessions').insert(
              templateSessions.map((session: any) => ({
                product_id: product.id,
                student_id: studentUserId,
                title: session.title,
                description: session.description,
                meeting_url: session.meeting_url,
                sort_order: session.sort_order,
                status: 'planned',
              }))
            )
          }
        }
      }
    } else {
      await supabase.from('student_access').insert(accessPayload)
    }

    const resendClient = getResendClient()
    if (resendClient && setupPasswordUrl) {
      await resendClient.emails.send({
        from: 'Flowyn <noreply@flowyn.com.br>',
        to: deliveryCustomerEmail,
        subject: `Defina sua senha para acessar "${product.name}"`,
        html: studentPasswordEmail({
          customerName: deliveryCustomerName,
          productName: product.name,
          setupUrl: setupPasswordUrl,
          learnUrl: `${appUrl}/learn`,
        }),
      })

      await supabase.from('notification_events').insert({
        user_id: studentUserId,
        product_id: product.id,
        recipient_email: deliveryCustomerEmail,
        event_type: 'student_password_setup',
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
    }
  }

  if (product?.delivery_type === 'external' || product?.delivery_type === 'platform') {
    const accessLinks: { label: string; url: string; isFile: boolean }[] = []

    if (product?.delivery_type === 'platform') {
      accessLinks.push({ label: 'Acessar na Flowyn', url: `${appUrl}/learn/${product.id}`, isFile: false })
    } else if (product.delivery_url) {
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
        to: deliveryCustomerEmail,
        subject: `Seu acesso a "${product.name}" esta pronto!`,
        html: deliveryEmail({
          customerName: deliveryCustomerName,
          productName: product.name,
          accessLinks,
        }),
      })
    }
  }

  dispatchWebhook(orderId).catch(err => console.error('[Order Fulfillment Webhook Error]:', err))

  return { skipped: false }
}
