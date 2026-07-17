import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getResendClient } from '@/lib/resend'
import { learningNotificationEmail } from '@/lib/email-templates'
import { getAppUrl } from '@/lib/app-url'
import { safeBearerCompare } from '@/lib/safe-bearer-compare'

export const dynamic = 'force-dynamic'

type Session = { id: string; product_id: string; student_id: string; scheduled_at: string; meeting_url: string | null }

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[Cron] CRON_SECRET não configurado — cron desabilitado')
    return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 503 })
  }
  const authHeader = request.headers.get('authorization') || ''
  if (!safeBearerCompare(authHeader, secret)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  const resend = getResendClient()
  if (!resend) return NextResponse.json({ error: 'Resend não configurado.' }, { status: 503 })

  const now = Date.now()
  const { data: sessions, error } = await admin.from('mentorship_sessions').select('id, product_id, student_id, scheduled_at, meeting_url').eq('status', 'scheduled').not('student_id', 'is', null).gte('scheduled_at', new Date(now + 45 * 60 * 1000).toISOString()).lte('scheduled_at', new Date(now + 25 * 60 * 60 * 1000).toISOString())
  if (error) {
    console.error('[Mentorship Reminders] Database error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  let sent = 0
  for (const session of (sessions || []) as Session[]) {
    const hours = (new Date(session.scheduled_at).getTime() - now) / 3600000
    const window = hours >= 23 && hours <= 25 ? '24h' : hours >= 0.75 && hours <= 1.25 ? '1h' : null
    if (!window) continue
    const eventType = `mentorship_session_reminder_${window}`
    const { data: prior } = await admin.from('notification_events').select('id').eq('event_type', eventType).eq('product_id', session.product_id).eq('user_id', session.student_id).contains('metadata', { session_id: session.id }).maybeSingle()
    if (prior) continue

    const [{ data: access }, { data: product }] = await Promise.all([
      admin.from('student_access').select('access_email').eq('product_id', session.product_id).eq('user_id', session.student_id).is('revoked_at', null).maybeSingle(),
      admin.from('products').select('name').eq('id', session.product_id).maybeSingle(),
    ])
    if (!access?.access_email) continue
    const when = new Date(session.scheduled_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const { error: sendError } = await resend.emails.send({ from: 'Flowyn <noreply@flowyn.com.br>', to: access.access_email, subject: `Lembrete: sua sessão é em ${window}`, html: learningNotificationEmail({ title: `Sua sessão é em ${window}`, message: `O encontro de "${product?.name || 'sua mentoria'}" está marcado para ${when}.`, actionLabel: 'Abrir jornada', actionUrl: `${getAppUrl()}/learn/${session.product_id}` }) })
    await admin.from('notification_events').insert({ user_id: session.student_id, product_id: session.product_id, recipient_email: access.access_email, event_type: eventType, status: sendError ? 'failed' : 'sent', sent_at: sendError ? null : new Date().toISOString(), metadata: { session_id: session.id, meeting_url_available: Boolean(session.meeting_url) } })
    if (!sendError) sent += 1
  }
  return NextResponse.json({ checked: sessions?.length || 0, sent })
}
