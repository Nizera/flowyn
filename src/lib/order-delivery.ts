import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { deliveryEmail, studentPasswordEmail } from '@/lib/email-templates'
import { getAppUrl } from '@/lib/app-url'
import { getResendClient } from '@/lib/resend'
import { createStudentPasswordSetupUrl, findAuthUserIdByEmail } from '@/lib/student-password-link'

type Product = {
  id: string
  name: string
  delivery_type?: string | null
  delivery_url?: string | null
  deliverable_file_paths?: string[] | null
}

export async function resendOrderDelivery(supabase: SupabaseClient, orderId: string) {
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, status, includes_order_bump,
      product:products(id, name, delivery_type, delivery_url, deliverable_file_paths)
    `)
    .eq('id', orderId)
    .maybeSingle()

  if (!order || order.status !== 'paid') return { sent: false, reason: 'not_found' as const }

  const product = order.product as unknown as Product | null
  if (!product) return { sent: false, reason: 'not_found' as const }

  const { data: customer } = await supabase
    .from('order_customer_private')
    .select('customer_name, customer_email')
    .eq('order_id', orderId)
    .maybeSingle()

  if (!customer?.customer_email) return { sent: false, reason: 'not_found' as const }

  const resend = getResendClient()
  if (!resend) return { sent: false, reason: 'unavailable' as const }

  const appUrl = getAppUrl()

  if (product.delivery_type === 'platform') {
    let createdStudent = false
    const { data: orderAccess } = await supabase
      .from('student_access')
      .select('user_id')
      .eq('order_id', orderId)
      .is('revoked_at', null)
      .maybeSingle()

    let access = orderAccess
    if (!access) {
      const { data: emailAccess } = await supabase
        .from('student_access')
        .select('user_id')
        .eq('product_id', product.id)
        .ilike('access_email', customer.customer_email)
        .is('revoked_at', null)
        .maybeSingle()
      access = emailAccess
    }

    if (!access?.user_id) {
      let userId = await findAuthUserIdByEmail(supabase, customer.customer_email)
      if (!userId) {
        const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
          email: customer.customer_email,
          email_confirm: true,
          user_metadata: {
            full_name: customer.customer_name,
            role: 'customer',
          },
        })

        if (createUserError || !createdUser.user) return { sent: false, reason: 'unavailable' as const }
        userId = createdUser.user.id
        createdStudent = true
      }

      if (!userId) return { sent: false, reason: 'not_found' as const }

      const { error: accessError } = await supabase.from('student_access').upsert({
        user_id: userId,
        product_id: product.id,
        order_id: orderId,
        access_email: customer.customer_email,
        granted_at: new Date().toISOString(),
      }, { onConflict: 'user_id,product_id' })

      if (accessError) return { sent: false, reason: 'unavailable' as const }
      access = { user_id: userId }
    }

    const productPath = `/learn/${product.id}`
    const learnUrl = `${appUrl}/login?redirect=${encodeURIComponent(productPath)}`
    const { data: setupEvent } = await supabase
      .from('notification_events')
      .select('id')
      .eq('user_id', access.user_id)
      .eq('product_id', product.id)
      .eq('event_type', 'student_password_setup')
      .limit(1)
      .maybeSingle()

    if (createdStudent || setupEvent) {
      const setupUrl = await createStudentPasswordSetupUrl(supabase, customer.customer_email, product.id)
      if (!setupUrl) return { sent: false, reason: 'unavailable' as const }

      await resend.emails.send({
        from: 'Flowyn <noreply@flowyn.com.br>',
        to: customer.customer_email,
        subject: `Defina sua senha para acessar "${product.name}"`,
        html: studentPasswordEmail({
          customerName: customer.customer_name,
          productName: product.name,
          setupUrl,
          learnUrl,
        }),
      })

      if (createdStudent) {
        await supabase.from('notification_events').insert({
          user_id: access.user_id,
          product_id: product.id,
          recipient_email: customer.customer_email,
          event_type: 'student_password_setup',
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
      }
    } else {
      await resend.emails.send({
        from: 'Flowyn <noreply@flowyn.com.br>',
        to: customer.customer_email,
        subject: `Seu acesso a "${product.name}" esta pronto!`,
        html: deliveryEmail({
          customerName: customer.customer_name,
          productName: product.name,
          accessLinks: [{ label: 'Acessar na Flowyn', url: learnUrl, isFile: false }],
        }),
      })
    }

    return { sent: true }
  }

  const accessLinks: { label: string; url: string; isFile: boolean }[] = []
  if (product.delivery_url) {
    accessLinks.push({ label: 'Acessar conteudo', url: product.delivery_url, isFile: false })
  }

  if (Array.isArray(product.deliverable_file_paths)) {
    for (const path of product.deliverable_file_paths) {
      const { data: signed } = await supabase.storage.from('product-files').createSignedUrl(path, 60 * 60 * 48)
      if (signed?.signedUrl) {
        accessLinks.push({ label: path.split('/').pop() || 'Baixar arquivo', url: signed.signedUrl, isFile: true })
      }
    }
  }

  if (order.includes_order_bump) {
    const { data: bumps } = await supabase
      .from('product_order_bumps')
      .select('file_paths')
      .eq('product_id', product.id)
      .order('sort_order', { ascending: true })

    for (const bump of bumps || []) {
      const paths = bump.file_paths as string[] | null
      for (const path of paths || []) {
        const { data: signed } = await supabase.storage.from('product-files').createSignedUrl(path, 60 * 60 * 48)
        if (signed?.signedUrl) {
          accessLinks.push({ label: path.split('/').pop() || 'Baixar order bump', url: signed.signedUrl, isFile: true })
        }
      }
    }
  }

  await resend.emails.send({
    from: 'Flowyn <noreply@flowyn.com.br>',
    to: customer.customer_email,
    subject: `Seu acesso a "${product.name}" esta pronto!`,
    html: deliveryEmail({
      customerName: customer.customer_name,
      productName: product.name,
      accessLinks,
    }),
  })

  return { sent: true }
}
