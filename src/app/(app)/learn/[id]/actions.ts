'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getResendClient } from '@/lib/resend'
import { learningNotificationEmail } from '@/lib/email-templates'
import { getAppUrl } from '@/lib/app-url'

export async function toggleLessonProgress(productId: string, lessonId: string, completed: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('lesson_progress').upsert({
    user_id: user.id,
    product_id: productId,
    lesson_id: lessonId,
    completed_at: completed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,lesson_id' })
  revalidatePath(`/learn/${productId}`)
  revalidatePath('/learn')
}

export async function toggleMentorshipTask(productId: string, taskId: string, completed: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: task } = await supabase.from('mentorship_tasks').update({
    completed_at: completed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', taskId).eq('product_id', productId).eq('student_id', user.id).select('title').maybeSingle()
  if (completed && task) {
    const { product } = await getMentorshipContext(productId, user.id)
    await notify({ recipient: product?.owner?.email, userId: product?.owner_id, productId, eventType: 'mentorship_task_completed', title: `Tarefa concluída em "${product?.name || 'sua mentoria'}"`, message: `${user.email || 'O aluno'} concluiu a tarefa "${task.title}".` })
  }
  revalidatePath(`/learn/${productId}`)
}

export async function addLessonComment(productId: string, lessonId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const body = String(formData.get('body') || '').trim()
  if (!body) return
  await supabase.from('lesson_comments').insert({ product_id: productId, lesson_id: lessonId, user_id: user.id, body })
  revalidatePath(`/learn/${productId}`)
}

export async function saveIntakeResponses(productId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const answers: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('question_')) answers[key.replace('question_', '')] = String(value || '').trim().slice(0, 5000)
  }
  const { error } = await supabase.from('mentorship_intake_responses').upsert({
    product_id: productId,
    student_id: user.id,
    answers,
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'product_id,student_id' })
  if (!error) {
    const { product } = await getMentorshipContext(productId, user.id)
    await notify({ recipient: product?.owner?.email, userId: product?.owner_id, productId, eventType: 'mentorship_intake_submitted', title: `Novo diagnóstico em "${product?.name || 'sua mentoria'}"`, message: `${user.email || 'O aluno'} enviou ou atualizou o diagnóstico inicial.` })
  }
  revalidatePath(`/learn/${productId}`)
}

async function getMentorshipContext(productId: string, userId: string) {
  const admin = createAdminClient()
  const [{ data: access }, { data: product }, { data: program }] = await Promise.all([
    admin.from('student_access').select('id, access_email').eq('user_id', userId).eq('product_id', productId).maybeSingle(),
    admin.from('products').select('id, name, owner_id, owner:profiles(full_name, email)').eq('id', productId).eq('product_type', 'mentoria').maybeSingle(),
    admin.from('mentorship_programs').select('session_count, booking_min_notice_hours, cancellation_notice_hours, max_reschedules, timezone').eq('product_id', productId).maybeSingle(),
  ])
  const normalizedProduct = product ? { ...product, owner: Array.isArray(product.owner) ? product.owner[0] : product.owner } : null
  return { admin, access, product: normalizedProduct, program }
}

async function notify(options: { recipient?: string | null; userId?: string | null; productId: string; eventType: string; title: string; message: string }) {
  if (!options.recipient) return
  const resend = getResendClient()
  const admin = createAdminClient()
  const baseEvent = {
    user_id: options.userId || null,
    product_id: options.productId,
    recipient_email: options.recipient,
    event_type: options.eventType,
  }
  if (!resend) {
    await admin.from('notification_events').insert({ ...baseEvent, status: 'failed', metadata: { reason: 'resend_not_configured' } })
    return
  }
  try {
    const { error } = await resend.emails.send({ from: 'Flowyn <noreply@flowyn.com.br>', to: options.recipient, subject: options.title, html: learningNotificationEmail({ title: options.title, message: options.message, actionLabel: 'Ver mentoria', actionUrl: `${getAppUrl()}/learn/${options.productId}` }) })
    if (error) throw error
    await admin.from('notification_events').insert({ ...baseEvent, status: 'sent', sent_at: new Date().toISOString() })
  } catch (error) {
    await admin.from('notification_events').insert({ ...baseEvent, status: 'failed', metadata: { reason: error instanceof Error ? error.message.slice(0, 500) : 'send_failed' } })
  }
}

export async function bookMentorshipSlot(productId: string, slotId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { admin, access, product, program } = await getMentorshipContext(productId, user.id)
  if (!access || !product) return

  const { data: slot } = await admin.from('mentorship_availability_slots').select('id, starts_at, ends_at').eq('id', slotId).eq('product_id', productId).is('booked_by', null).maybeSingle()
  if (!slot || new Date(slot.starts_at).getTime() < Date.now() + Number(program?.booking_min_notice_hours ?? 2) * 3600000) return
  const { count } = await admin.from('mentorship_sessions').select('id', { count: 'exact', head: true }).eq('product_id', productId).eq('student_id', user.id).in('status', ['scheduled', 'done', 'missed'])
  if (Number(count || 0) >= Number(program?.session_count || 4)) return
  const { data: privateSlot } = await admin.from('mentorship_slot_private').select('meeting_url').eq('slot_id', slotId).maybeSingle()

  const { data: session } = await admin.from('mentorship_sessions').insert({
    product_id: productId,
    student_id: user.id,
    title: 'Sessão agendada',
    description: 'Horário reservado pelo aluno.',
    scheduled_at: slot.starts_at,
    ends_at: slot.ends_at,
    meeting_url: privateSlot?.meeting_url || null,
    status: 'scheduled',
  }).select('id').single()
  if (!session) return

  const { data: reserved } = await admin.from('mentorship_availability_slots').update({ booked_by: user.id, booked_session_id: session.id, updated_at: new Date().toISOString() }).eq('id', slotId).is('booked_by', null).select('id').maybeSingle()
  if (!reserved) {
    await admin.from('mentorship_sessions').delete().eq('id', session.id)
    return
  }

  const time = new Date(slot.starts_at).toLocaleString('pt-BR', { timeZone: program?.timezone || 'America/Sao_Paulo' })
  await Promise.all([
    notify({ recipient: user.email, userId: user.id, productId, eventType: 'mentorship_session_booked', title: `Sessão agendada em "${product.name}"`, message: `Sua sessão foi marcada para ${time}.` }),
    notify({ recipient: product.owner?.email, userId: product.owner_id, productId, eventType: 'mentorship_session_booked_mentor', title: `Nova sessão em "${product.name}"`, message: `${user.email || 'Um aluno'} reservou uma sessão para ${time}.` }),
  ])
  revalidatePath(`/learn/${productId}`)
}

export async function cancelMentorshipSession(productId: string, sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { admin, access, product, program } = await getMentorshipContext(productId, user.id)
  if (!access || !product) return
  const { data: session } = await admin.from('mentorship_sessions').select('id, scheduled_at').eq('id', sessionId).eq('product_id', productId).eq('student_id', user.id).eq('status', 'scheduled').maybeSingle()
  if (!session?.scheduled_at || new Date(session.scheduled_at).getTime() < Date.now() + Number(program?.cancellation_notice_hours ?? 24) * 3600000) return
  const { data: slot } = await admin.from('mentorship_availability_slots').select('id').eq('booked_session_id', sessionId).eq('booked_by', user.id).maybeSingle()
  await admin.from('mentorship_sessions').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'Cancelado pelo aluno', updated_at: new Date().toISOString() }).eq('id', sessionId).eq('student_id', user.id)
  if (slot) await admin.from('mentorship_availability_slots').update({ booked_by: null, booked_session_id: null, updated_at: new Date().toISOString() }).eq('id', slot.id).eq('booked_by', user.id)
  const time = new Date(session.scheduled_at).toLocaleString('pt-BR', { timeZone: program?.timezone || 'America/Sao_Paulo' })
  await Promise.all([
    notify({ recipient: user.email, userId: user.id, productId, eventType: 'mentorship_session_cancelled', title: 'Sessão cancelada', message: `A sessão de ${time} foi cancelada.` }),
    notify({ recipient: product.owner?.email, userId: product.owner_id, productId, eventType: 'mentorship_session_cancelled_mentor', title: `Sessão cancelada em "${product.name}"`, message: `${user.email || 'Um aluno'} cancelou a sessão de ${time}.` }),
  ])
  revalidatePath(`/learn/${productId}`)
}

export async function rescheduleMentorshipSession(productId: string, sessionId: string, formData: FormData) {
  const newSlotId = String(formData.get('slot_id') || '')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !newSlotId) return
  const { admin, access, product, program } = await getMentorshipContext(productId, user.id)
  if (!access || !product) return
  const { data: session } = await admin.from('mentorship_sessions').select('id, scheduled_at, reschedule_count').eq('id', sessionId).eq('student_id', user.id).eq('product_id', productId).eq('status', 'scheduled').maybeSingle()
  const { data: newSlot } = await admin.from('mentorship_availability_slots').select('id, starts_at, ends_at').eq('id', newSlotId).eq('product_id', productId).is('booked_by', null).maybeSingle()
  if (!session || !newSlot || Number(session.reschedule_count || 0) >= Number(program?.max_reschedules ?? 2)) return
  if (new Date(newSlot.starts_at).getTime() < Date.now() + Number(program?.booking_min_notice_hours ?? 2) * 3600000) return
  if (session.scheduled_at && new Date(session.scheduled_at).getTime() < Date.now() + Number(program?.cancellation_notice_hours ?? 24) * 3600000) return

  const { data: oldSlot } = await admin.from('mentorship_availability_slots').select('id').eq('booked_session_id', sessionId).eq('booked_by', user.id).maybeSingle()
  const { data: reserved } = await admin.from('mentorship_availability_slots').update({ booked_by: user.id, booked_session_id: sessionId, updated_at: new Date().toISOString() }).eq('id', newSlotId).is('booked_by', null).select('id').maybeSingle()
  if (!reserved) return
  const { data: privateSlot } = await admin.from('mentorship_slot_private').select('meeting_url').eq('slot_id', newSlotId).maybeSingle()
  const { error: updateError } = await admin.from('mentorship_sessions').update({ scheduled_at: newSlot.starts_at, ends_at: newSlot.ends_at, meeting_url: privateSlot?.meeting_url || null, reschedule_count: Number(session.reschedule_count || 0) + 1, updated_at: new Date().toISOString() }).eq('id', sessionId).eq('student_id', user.id)
  if (updateError) {
    await admin.from('mentorship_availability_slots').update({ booked_by: null, booked_session_id: null, updated_at: new Date().toISOString() }).eq('id', newSlotId).eq('booked_by', user.id)
    return
  }
  if (oldSlot) await admin.from('mentorship_availability_slots').update({ booked_by: null, booked_session_id: null, updated_at: new Date().toISOString() }).eq('id', oldSlot.id).eq('booked_by', user.id)
  const time = new Date(newSlot.starts_at).toLocaleString('pt-BR', { timeZone: program?.timezone || 'America/Sao_Paulo' })
  await Promise.all([
    notify({ recipient: user.email, userId: user.id, productId, eventType: 'mentorship_session_rescheduled', title: 'Sessão reagendada', message: `Sua nova sessão será em ${time}.` }),
    notify({ recipient: product.owner?.email, userId: product.owner_id, productId, eventType: 'mentorship_session_rescheduled_mentor', title: `Sessão reagendada em "${product.name}"`, message: `${user.email || 'Um aluno'} reagendou a sessão para ${time}.` }),
  ])
  revalidatePath(`/learn/${productId}`)
}
