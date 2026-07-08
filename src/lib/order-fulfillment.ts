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

async function sendEmailWithRetry(
  params: { from: string; to: string; subject: string; html: string },
  supabase: SupabaseAdmin,
  orderId: string,
  eventType: string,
) {
  const resend = getResendClient()
  if (!resend) return false

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await resend.emails.send(params)
      if (!error) {
        await supabase.from('notification_events').insert({
          product_id: null,
          recipient_email: params.to,
          event_type: eventType,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        return true
      }
      if (attempt === 0) await new Promise(r => setTimeout(r, 2000))
    } catch {
      if (attempt === 0) await new Promise(r => setTimeout(r, 2000))
    }
  }

  await supabase.from('notification_events').insert({
    product_id: null,
    recipient_email: params.to,
    event_type: eventType,
    status: 'failed',
    metadata: { order_id: orderId, error: 'email_send_failed_after_retry' },
  })
  console.error('[Delivery] Email send failed after retry:', { orderId, eventType })
  return false
}

async function buildFileLinks(product: Product, supabase: SupabaseAdmin) {
  const links: { label: string; url: string; isFile: boolean }[] = []

  if (Array.isArray(product.deliverable_file_paths)) {
    for (const path of product.deliverable_file_paths) {
      const { data: signed } = await supabase.storage
        .from('product-files')
        .createSignedUrl(path, 60 * 60 * 48)

      if (signed?.signedUrl) {
        links.push({ label: path.split('/').pop() || 'Baixar Arquivo', url: signed.signedUrl, isFile: true })
      }
    }
  }

  return links
}

async function buildOrderBumpLinks(orderData: { includes_order_bump?: boolean; product_id?: string }, product: Product, supabase: SupabaseAdmin) {
  const links: { label: string; url: string; isFile: boolean }[] = []

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
              links.push({ label: path.split('/').pop() || 'Baixar Order Bump', url: signed.signedUrl, isFile: true })
            }
          }
        }
      }
    }
  }

  return links
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
      console.warn(`[fulfillPaidOrder] Skipping student_access insert — no auth user found for email "${deliveryCustomerEmail}" (order ${orderId}). Order needs manual resolution.`)
    }

    const fileLinks = product ? await buildFileLinks(product, supabase) : []
    const bumpLinks = product ? await buildOrderBumpLinks(orderData, product, supabase) : []
    const allFileLinks = [...fileLinks, ...bumpLinks]

    if (setupPasswordUrl) {
      await sendEmailWithRetry({
        from: 'Flowyn <noreply@flowyn.com.br>',
        to: deliveryCustomerEmail,
        subject: `Defina sua senha para acessar "${product!.name}"`,
        html: studentPasswordEmail({
          customerName: deliveryCustomerName,
          productName: product!.name,
          setupUrl: setupPasswordUrl,
          learnUrl: platformAccessUrl!,
          accessLinks: allFileLinks.length > 0 ? allFileLinks : undefined,
        }),
      }, supabase, orderId, 'student_password_setup')
    } else if (!platformStudentIsNew && platformAccessUrl) {
      const accessLinks = [{ label: 'Acessar na Flowyn', url: platformAccessUrl, isFile: false }, ...allFileLinks]
      await sendEmailWithRetry({
        from: 'Flowyn <noreply@flowyn.com.br>',
        to: deliveryCustomerEmail,
        subject: `Seu acesso a "${product!.name}" esta pronto!`,
        html: deliveryEmail({
          customerName: deliveryCustomerName,
          productName: product!.name,
          accessLinks,
        }),
      }, supabase, orderId, 'delivery_access')
    }
  }

  if (product?.delivery_type === 'external') {
    const hasContent = product.delivery_url || (Array.isArray(product.deliverable_file_paths) && product.deliverable_file_paths.length > 0)

    if (!hasContent) {
      console.warn('[Delivery] External product has no delivery_url or files:', { orderId, productId: product.id })
      return { skipped: false, warning: 'no_content' }
    }

    const accessLinks: { label: string; url: string; isFile: boolean }[] = []

    if (product.delivery_url) {
      accessLinks.push({ label: 'Acessar Conteudo', url: product.delivery_url, isFile: false })
    }

    accessLinks.push(...await buildFileLinks(product, supabase))
    accessLinks.push(...await buildOrderBumpLinks(orderData, product, supabase))

    if (accessLinks.length > 0) {
      await sendEmailWithRetry({
        from: 'Flowyn <noreply@flowyn.com.br>',
        to: deliveryCustomerEmail,
        subject: `Seu acesso a "${product.name}" esta pronto!`,
        html: deliveryEmail({
          customerName: deliveryCustomerName,
          productName: product.name,
          accessLinks,
        }),
      }, supabase, orderId, 'delivery_access')
    }
  }

  return { skipped: false }
}

export async function revokePaidOrder(supabase: SupabaseAdmin, orderId: string, reason: string) {
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id, status, amount')
    .eq('id', orderId)
    .single()

  if (!existingOrder || existingOrder.status !== 'paid') {
    return { skipped: true }
  }

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .update({
      asaas_status: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select('*, product:products(id, delivery_type)')
    .single()

  if (orderError || !orderData) {
    return { skipped: true, error: orderError?.message }
  }

  const product = orderData.product as Product | null

  if (product?.delivery_type === 'platform') {
    const { data: privateCustomer } = await supabase
      .from('order_customer_private')
      .select('customer_email')
      .eq('order_id', orderId)
      .single()

    const email = privateCustomer?.customer_email || orderData.customer_email
    if (email) {
      const { data: student } = await supabase
        .from('student_access')
        .select('user_id')
        .eq('access_email', email)
        .eq('product_id', product.id)
        .maybeSingle()

      if (student?.user_id) {
        await supabase
          .from('student_access')
          .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
          .eq('user_id', student.user_id)
          .eq('product_id', product.id)
      }
    }
  }

  return { skipped: false }
}
