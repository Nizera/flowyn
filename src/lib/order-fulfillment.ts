import 'server-only'
import { getResendClient } from '@/lib/resend'
import { deliveryEmail, studentPasswordEmail } from '@/lib/email-templates'
import { getAppUrl } from '@/lib/app-url'
import { createStudentPasswordSetupUrl, findAuthUserIdByEmail } from '@/lib/student-password-link'

import type { SupabaseClient } from '@supabase/supabase-js'

type SupabaseAdmin = SupabaseClient

type Product = {
  id: string
  name: string
  product_type?: string | null
  delivery_type?: string | null
  delivery_url?: string | null
  deliverable_file_paths?: string[] | null
}

type TemplateSession = {
  title?: string | null
  description?: string | null
  meeting_url?: string | null
  sort_order?: number | null
}

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
        id, name, product_type, delivery_type, delivery_url, deliverable_file_paths
      )
    `)
    .single()

  if (orderError || !orderData) {
    return { skipped: true, error: orderError?.message }
  }

  const product = orderData.product as Product | null
  const { data: privateCustomer } = await supabase
    .from('order_customer_private')
    .select('customer_name, customer_email')
    .eq('order_id', orderId)
    .single()

  const deliveryCustomerName = privateCustomer?.customer_name || orderData.customer_name
  const deliveryCustomerEmail = privateCustomer?.customer_email || orderData.customer_email
  const appUrl = getAppUrl()
  let platformStudentIsNew = false
  let platformAccessUrl: string | null = null

  if (product?.delivery_type === 'platform') {
    let studentUserId = await findAuthUserIdByEmail(supabase, deliveryCustomerEmail)
    let setupPasswordUrl: string | null = null
    const productPath = `/learn/${product.id}`
    platformAccessUrl = `${appUrl}/login?redirect=${encodeURIComponent(productPath)}`

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
      platformStudentIsNew = Boolean(studentUserId)

      if (studentUserId) {
        setupPasswordUrl = await createStudentPasswordSetupUrl(supabase, deliveryCustomerEmail, product.id)
      }
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
              templateSessions.map((session: TemplateSession) => ({
                product_id: product!.id,
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
          learnUrl: platformAccessUrl,
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
      if (!platformStudentIsNew && platformAccessUrl) {
        accessLinks.push({ label: 'Acessar na Flowyn', url: platformAccessUrl, isFile: false })
      }
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

    if (orderData.includes_order_bump) {
      const { data: orderBumps } = await supabase
        .from('product_order_bumps')
        .select('file_paths')
        .eq('product_id', product.id)
        .order('sort_order', { ascending: true })

      if (orderBumps) {
        for (const bump of orderBumps) {
          const paths = bump.file_paths as string[] | null
          if (Array.isArray(paths)) {
            for (const path of paths) {
              const { data: signed } = await supabase.storage
                .from('product-files')
                .createSignedUrl(path, 60 * 60 * 48)

              if (signed?.signedUrl) {
                accessLinks.push({ label: path.split('/').pop() || 'Baixar Order Bump', url: signed.signedUrl, isFile: true })
              }
            }
          }
        }
      }
    }

    const resendClient = getResendClient()
    if (resendClient && (product.delivery_type === 'external' || accessLinks.length > 0)) {
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

  return { skipped: false }
}
