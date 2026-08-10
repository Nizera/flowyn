import webPush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:noreply@flowyn.com.br'

let isConfigured = false

function configureVapid() {
  if (isConfigured || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return
  webPush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  isConfigured = true
}

type PushPayload = {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
}

export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  configureVapid()
  if (!isConfigured) {
    console.warn('[Push] VAPID keys not configured')
    return { sent: 0, failed: 0 }
  }

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 }
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icon.png',
    badge: payload.badge || '/icon.png',
    tag: payload.tag || 'flowyn-sale',
    url: payload.url || '/dashboard/sales',
  })

  let sent = 0
  let failed = 0

  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        notificationPayload
      )

      await supabase
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', sub.id)

      sent++
    } catch (err: any) {
      console.error(`[Push] Failed to send to ${sub.id}:`, err.message)

      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('id', sub.id)
      }

      failed++
    }
  }

  return { sent, failed }
}

export async function sendPushToProducer(
  supabase: SupabaseClient,
  producerId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  return sendPushToUser(supabase, producerId, payload)
}
