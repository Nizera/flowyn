import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Building2, CalendarClock, CheckCircle2, CreditCard, FileLock2, Palette, Pencil, Plus, Route, ShoppingBag, Trash2, Users } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getResendClient } from '@/lib/resend'
import { learningNotificationEmail } from '@/lib/email-templates'
import { getAppUrl } from '@/lib/app-url'

type SessionRow = {
  id: string
  title: string
  description: string | null
  meeting_url: string | null
  sort_order: number | null
}

type StudentRow = {
  user_id: string
  access_email: string | null
  profile: { full_name: string | null } | null
}

type SlotRow = {
  id: string
  starts_at: string
  ends_at: string
  booked_by: string | null
  booked_session_id?: string | null
}

type StudentSessionRow = { id: string; student_id: string; title: string; scheduled_at: string | null; status: string; reschedule_count: number; meeting_url: string | null }
type StudentTaskRow = { id: string; student_id: string; title: string; due_at: string | null; completed_at: string | null }
type PrivateNoteRow = { id: string; student_id: string; body: string; created_at: string }

type IntakeRow = {
  student_id: string
  answers: Record<string, unknown> | null
  submitted_at: string
  profile: { full_name: string | null } | null
}

function getRecentStartDateIso() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export const dynamic = 'force-dynamic'

export default async function MentorshipJourneyPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: product } = await supabase
    .from('products')
    .select('id, owner_id, name, product_type, cover_url, short_description, description')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (!product) redirect('/dashboard/products')

  const { data: program } = await supabase.from('mentorship_programs').select('id, headline, promise, session_duration_minutes, intake_questions, timezone, session_count, booking_min_notice_hours, cancellation_notice_hours, max_reschedules').eq('product_id', id).maybeSingle()
  const { data: sessions } = await supabase.from('mentorship_sessions').select('id, title, description, status, scheduled_at, ends_at, meeting_url, sort_order, reschedule_count').eq('product_id', id).is('student_id', null).order('sort_order', { ascending: true })
  const { data: students } = await supabase.from('student_access').select('user_id, access_email, granted_at, profile:profiles(full_name)').eq('product_id', id).is('revoked_at', null).order('granted_at', { ascending: false })
  const { data: slots } = await supabase.from('mentorship_availability_slots').select('id, starts_at, ends_at').eq('product_id', id).gte('starts_at', getRecentStartDateIso()).order('starts_at', { ascending: true })
  const { data: intakeResponses } = await supabase.from('mentorship_intake_responses').select('student_id, answers, submitted_at, profile:profiles(full_name)').eq('product_id', id).order('submitted_at', { ascending: false })
  const { data: privateProgram } = await supabase.from('mentorship_program_private').select('default_meeting_url').eq('product_id', id).maybeSingle()
  const { data: studentSessions } = await supabase.from('mentorship_sessions').select('id, student_id, title, scheduled_at, status, reschedule_count, meeting_url').eq('product_id', id).not('student_id', 'is', null).order('scheduled_at', { ascending: false })
  const { data: studentTasks } = await supabase.from('mentorship_tasks').select('id, student_id, title, due_at, completed_at').eq('product_id', id).order('created_at', { ascending: false })
  const { data: privateNotes } = await supabase.from('mentorship_private_notes').select('id, student_id, body, created_at').eq('product_id', id).order('created_at', { ascending: false })

  async function saveProgram(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('mentorship_programs').upsert({
      product_id: id,
      headline: String(formData.get('headline') || '').trim() || null,
      promise: String(formData.get('promise') || '').trim() || null,
      session_count: Number(formData.get('session_count') || 4) || 4,
      session_duration_minutes: Number(formData.get('session_duration_minutes') || 60) || 60,
      intake_questions: String(formData.get('intake_questions') || '').split('\n').map(question => question.trim()).filter(Boolean),
      timezone: String(formData.get('timezone') || 'America/Sao_Paulo'),
      booking_min_notice_hours: Math.max(0, Number(formData.get('booking_min_notice_hours') || 2)),
      cancellation_notice_hours: Math.max(0, Number(formData.get('cancellation_notice_hours') || 24)),
      max_reschedules: Math.max(0, Number(formData.get('max_reschedules') || 2)),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'product_id' })

    await supabase.from('mentorship_program_private').upsert({
      product_id: id,
      default_meeting_url: String(formData.get('meeting_url') || '').trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'product_id' })

    revalidatePath(`/dashboard/products/${id}/journey`)
  }

  async function createSession(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const title = String(formData.get('title') || '').trim()
    if (!title) return

    const { count } = await supabase.from('mentorship_sessions').select('id', { count: 'exact', head: true }).eq('product_id', id).is('student_id', null)
    await supabase.from('mentorship_sessions').insert({
      product_id: id,
      title,
      description: String(formData.get('description') || '').trim() || null,
      meeting_url: String(formData.get('meeting_url') || '').trim() || null,
      status: 'planned',
      sort_order: count || 0,
    })

    revalidatePath(`/dashboard/products/${id}/journey`)
  }

  async function deleteSession(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const sessionId = String(formData.get('session_id') || '')
    if (!sessionId) return
    await supabase.from('mentorship_sessions').delete().eq('id', sessionId).eq('product_id', id)
    revalidatePath(`/dashboard/products/${id}/journey`)
  }

  async function editSession(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const sessionId = String(formData.get('session_id') || '')
    const title = String(formData.get('title') || '').trim()
    if (!sessionId || !title) return
    await supabase.from('mentorship_sessions').update({ title, description: String(formData.get('description') || '').trim() || null, sort_order: Math.max(0, Number(formData.get('sort_order') || 0)), updated_at: new Date().toISOString() }).eq('id', sessionId).eq('product_id', id).is('student_id', null)
    revalidatePath(`/dashboard/products/${id}/journey`)
  }

  async function createSlot(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const startsAt = String(formData.get('starts_at') || '')
    const duration = Number(formData.get('duration_minutes') || 60) || 60
    if (!startsAt) return

    const startDate = new Date(startsAt)
    const { data: slot } = await supabase.from('mentorship_availability_slots').insert({
      product_id: id,
      starts_at: startDate.toISOString(),
      ends_at: new Date(startDate.getTime() + duration * 60 * 1000).toISOString(),
    }).select('id').single()

    if (slot) await supabase.from('mentorship_slot_private').insert({ slot_id: slot.id, meeting_url: String(formData.get('meeting_url') || '').trim() || null })

    revalidatePath(`/dashboard/products/${id}/journey`)
  }

  async function deleteSlot(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const slotId = String(formData.get('slot_id') || '')
    if (!slotId) return
    await supabase.from('mentorship_availability_slots').delete().eq('id', slotId).eq('product_id', id).is('booked_by', null)
    revalidatePath(`/dashboard/products/${id}/journey`)
  }

  async function updateStudentSession(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const sessionId = String(formData.get('session_id') || '')
    const status = String(formData.get('status') || '')
    if (!user || !sessionId || !['scheduled', 'done', 'missed', 'cancelled'].includes(status)) return
    const admin = createAdminClient()
    const { data: session } = await admin.from('mentorship_sessions').select('student_id, scheduled_at').eq('id', sessionId).eq('product_id', id).maybeSingle()
    const { data: ownedProduct } = await admin.from('products').select('name').eq('id', id).eq('owner_id', user.id).maybeSingle()
    if (!session?.student_id || !ownedProduct) return
    await admin.from('mentorship_sessions').update({ status, cancelled_at: status === 'cancelled' ? new Date().toISOString() : null, cancellation_reason: status === 'cancelled' ? 'Cancelado pelo mentor' : null, updated_at: new Date().toISOString() }).eq('id', sessionId).eq('product_id', id)
    if (status === 'cancelled') await admin.from('mentorship_availability_slots').update({ booked_by: null, booked_session_id: null, updated_at: new Date().toISOString() }).eq('booked_session_id', sessionId)
    const [{ data: access }, resend] = await Promise.all([
      admin.from('student_access').select('access_email').eq('product_id', id).eq('user_id', session.student_id).is('revoked_at', null).maybeSingle(),
      Promise.resolve(getResendClient()),
    ])
    if (access?.access_email && resend) {
      const labels: Record<string, string> = { scheduled: 'agendada', done: 'marcada como realizada', missed: 'marcada como falta', cancelled: 'cancelada' }
      const { error } = await resend.emails.send({ from: 'Flowyn <noreply@flowyn.com.br>', to: access.access_email, subject: `Sessão ${labels[status]} em "${ownedProduct.name}"`, html: learningNotificationEmail({ title: `Sessão ${labels[status]}`, message: session.scheduled_at ? `Atualização da sessão de ${new Date(session.scheduled_at).toLocaleString('pt-BR')}.` : 'O status de uma sessão da sua mentoria foi atualizado.', actionLabel: 'Ver jornada', actionUrl: `${getAppUrl()}/learn/${id}` }) })
      await admin.from('notification_events').insert({ user_id: session.student_id, product_id: id, recipient_email: access.access_email, event_type: `mentorship_session_${status}_by_mentor`, status: error ? 'failed' : 'sent', sent_at: error ? null : new Date().toISOString(), metadata: { session_id: sessionId } })
    }
    revalidatePath(`/dashboard/products/${id}/journey`)
  }

  async function addPrivateNote(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const studentId = String(formData.get('student_id') || '')
    const body = String(formData.get('body') || '').trim().slice(0, 10000)
    if (!user || !studentId || !body) return
    const { data: access } = await supabase.from('student_access').select('id').eq('product_id', id).eq('user_id', studentId).is('revoked_at', null).maybeSingle()
    if (!access) return
    await supabase.from('mentorship_private_notes').insert({ product_id: id, student_id: studentId, author_id: user.id, body })
    revalidatePath(`/dashboard/products/${id}/journey`)
  }

  async function deletePrivateNote(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const noteId = String(formData.get('note_id') || '')
    if (!noteId) return
    await supabase.from('mentorship_private_notes').delete().eq('id', noteId).eq('product_id', id)
    revalidatePath(`/dashboard/products/${id}/journey`)
  }

  async function createTask(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const studentId = String(formData.get('student_id') || '')
    const title = String(formData.get('title') || '').trim()
    if (!studentId || !title) return

    const { data: task } = await supabase.from('mentorship_tasks').insert({
      product_id: id,
      student_id: studentId,
      title,
      description: String(formData.get('description') || '').trim() || null,
      due_at: formData.get('due_at') ? new Date(String(formData.get('due_at'))).toISOString() : null,
    }).select('id, title').single()

    const resendClient = getResendClient()
    if (resendClient && task) {
      const admin = createAdminClient()
      const { data: access } = await admin.from('student_access').select('access_email').eq('product_id', id).eq('user_id', studentId).is('revoked_at', null).maybeSingle()
      const { data: product } = await admin.from('products').select('name').eq('id', id).single()
      const appUrl = getAppUrl()

      if (access?.access_email) {
        await resendClient.emails.send({
          from: 'Flowyn <noreply@flowyn.com.br>',
          to: access.access_email,
          subject: `Nova tarefa em "${product?.name || 'sua mentoria'}"`,
          html: learningNotificationEmail({
            title: 'Nova tarefa da mentoria',
            message: `Seu mentor adicionou a tarefa "${task.title}".`,
            actionLabel: 'Ver jornada',
            actionUrl: `${appUrl}/learn/${id}`,
          }),
        })
        await admin.from('notification_events').insert({
          user_id: studentId,
          product_id: id,
          recipient_email: access.access_email,
          event_type: 'mentorship_task_created',
          status: 'sent',
          sent_at: new Date().toISOString(),
          metadata: { task_id: task.id },
        })
      }
    }

    revalidatePath(`/dashboard/products/${id}/journey`)
  }

  const isMentorship = product.product_type === 'mentoria'
  const sessionRows = (sessions ?? []) as SessionRow[]
  const studentRows = ((students ?? []) as unknown as StudentRow[]).filter(row => Boolean(row.user_id))
  const slotRows = (slots ?? []) as SlotRow[]
  const intakeRows = (intakeResponses ?? []) as unknown as IntakeRow[]
  const studentSessionRows = (studentSessions ?? []) as StudentSessionRow[]
  const studentTaskRows = (studentTasks ?? []) as StudentTaskRow[]
  const noteRows = (privateNotes ?? []) as PrivateNoteRow[]
  const intakeQuestions = Array.isArray(program?.intake_questions) ? program.intake_questions.join('\n') : ''

  return (
    <section className="overflow-hidden rounded-[10px] bg-card px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href={`/dashboard/products/${id}`} className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Mentoria</h2>
            <p className="mt-2 text-sm text-muted">Configure diagnostico, agenda, tarefas e sessoes de {product.name}.</p>
          </div>
        </div>
      </div>

      <ProductTabs productId={id} active="journey" />

      {!isMentorship ? (
        <div className="mt-10 grid border-y border-border md:grid-cols-[240px_1fr]">
          <RowTitle title="Indisponivel" description="Produto nao e mentoria." />
          <div className="py-6 md:pl-8">
            <p className="max-w-2xl text-sm leading-6 text-muted">Altere o tipo para Mentoria / Coaching nos detalhes do produto para usar esta area.</p>
          </div>
        </div>
      ) : (
        <div className="mt-10 max-w-6xl">
          <div className="grid border-y border-border md:grid-cols-[240px_1fr]">
            <RowTitle title="Resumo" description="Jornada da mentoria." />
            <div className="grid gap-6 py-6 md:grid-cols-4 md:pl-8">
              <Metric label="Etapas" value={sessionRows.length} />
              <Metric label="Alunos" value={studentRows.length} />
              <Metric label="Horarios" value={slotRows.length} />
              <Metric label="Diagnosticos" value={intakeRows.length} />
            </div>
          </div>

          <div className="grid border-b border-border md:grid-cols-[240px_1fr]">
            <RowTitle title="Programa" description="Promessa, formato e diagnostico." />
            <form action={saveProgram} className="grid gap-5 py-6 md:pl-8 lg:grid-cols-2">
              <Field label="Headline da jornada"><Input name="headline" defaultValue={program?.headline || ''} placeholder={product.name} /></Field>
              <Field label="Link padrão Zoom/Meet" hint="Privado. Só é liberado ao aluno que reservar uma sessão."><Input name="meeting_url" defaultValue={privateProgram?.default_meeting_url || ''} placeholder="https://..." /></Field>
              <Field label="Sessoes"><Input name="session_count" type="number" defaultValue={String(program?.session_count || 4)} placeholder="4" /></Field>
              <Field label="Duracao por sessao"><Input name="session_duration_minutes" type="number" defaultValue={String(program?.session_duration_minutes || 60)} placeholder="60" /></Field>
              <Field label="Fuso horário"><Input name="timezone" defaultValue={program?.timezone || 'America/Sao_Paulo'} placeholder="America/Sao_Paulo" /></Field>
              <Field label="Antecedência para reservar (horas)"><Input name="booking_min_notice_hours" type="number" defaultValue={String(program?.booking_min_notice_hours ?? 2)} placeholder="2" /></Field>
              <Field label="Antecedência para cancelar (horas)"><Input name="cancellation_notice_hours" type="number" defaultValue={String(program?.cancellation_notice_hours ?? 24)} placeholder="24" /></Field>
              <Field label="Máximo de reagendamentos"><Input name="max_reschedules" type="number" defaultValue={String(program?.max_reschedules ?? 2)} placeholder="2" /></Field>
              <div className="lg:col-span-2">
                <Field label="Promessa e resultado esperado">
                  <textarea name="promise" defaultValue={program?.promise || ''} className={textareaClass} placeholder="O que o aluno deve conquistar ao final da jornada?" />
                </Field>
              </div>
              <div className="lg:col-span-2">
                <Field label="Perguntas de diagnostico" hint="Uma pergunta por linha. O aluno responde antes de iniciar.">
                  <textarea name="intake_questions" defaultValue={intakeQuestions} className={`${textareaClass} min-h-32`} placeholder="Qual seu maior desafio hoje?" />
                </Field>
              </div>
              <div className="lg:col-span-2">
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Salvar jornada
                </button>
              </div>
            </form>
          </div>

          <div className="grid border-b border-border md:grid-cols-[240px_1fr]">
            <RowTitle title="Etapas" description="Mapa da transformacao." />
            <div className="space-y-5 py-6 md:pl-8">
              <form action={createSession} className="grid gap-5 lg:grid-cols-2">
                <Field label="Titulo da etapa" required><Input name="title" placeholder="Ex: Diagnostico inicial" required /></Field>
                <Field label="Link especifico"><Input name="meeting_url" placeholder="https://..." /></Field>
                <div className="lg:col-span-2">
                  <Field label="Objetivo da etapa"><textarea name="description" className={textareaClass} placeholder="Objetivo desta etapa" /></Field>
                </div>
                <div className="lg:col-span-2">
                  <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-5 text-sm font-semibold text-orange-600 transition hover:bg-orange-100">
                    <Plus className="h-4 w-4" />
                    Adicionar etapa
                  </button>
                </div>
              </form>

              {sessionRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
                  <Route className="mx-auto h-10 w-10 text-muted" />
                  <p className="mt-3 text-sm text-muted">Crie as etapas da jornada: diagnostico, estrategia, execucao e revisao.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  {sessionRows.map((session, index) => (
                    <details key={session.id} className="group border-b border-border p-5 last:border-b-0">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
                        <div className="flex gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 font-semibold text-orange-600">{index + 1}</div>
                          <div><h3 className="font-semibold text-foreground">{session.title}</h3>{session.description && <p className="mt-1 text-sm text-muted">{session.description}</p>}</div>
                        </div>
                        <Pencil className="h-4 w-4 text-muted transition group-open:text-orange-500" />
                      </summary>
                      <form action={editSession} className="mt-5 grid gap-3 rounded-xl bg-surface p-4 md:grid-cols-2">
                        <input type="hidden" name="session_id" value={session.id} />
                        <Input name="title" defaultValue={session.title} placeholder="Título" required />
                        <Input name="sort_order" type="number" defaultValue={String(session.sort_order ?? index)} placeholder="Ordem" />
                        <div className="md:col-span-2"><textarea name="description" defaultValue={session.description || ''} className={textareaClass} placeholder="Objetivo da etapa" /></div>
                        <div className="flex gap-2 md:col-span-2">
                          <button className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white">Salvar etapa</button>
                        </div>
                      </form>
                      <form action={deleteSession} className="mt-2">
                        <input type="hidden" name="session_id" value={session.id} />
                        <button className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />Excluir etapa modelo</button>
                      </form>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid border-b border-border md:grid-cols-[240px_1fr]">
            <RowTitle title="Agenda" description="Horarios disponiveis." />
            <div className="space-y-5 py-6 md:pl-8">
              <form action={createSlot} className="grid gap-5 lg:grid-cols-[1fr_160px_1fr_auto] lg:items-end">
                <Field label="Inicio" required><Input name="starts_at" type="datetime-local" placeholder="Inicio" required /></Field>
                <Field label="Duracao"><Input name="duration_minutes" type="number" placeholder="60" defaultValue={String(program?.session_duration_minutes || 60)} /></Field>
                <Field label="Link da sala"><Input name="meeting_url" placeholder="https://..." defaultValue={privateProgram?.default_meeting_url || ''} /></Field>
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-5 text-sm font-semibold text-orange-600 transition hover:bg-orange-100">
                  <Plus className="h-4 w-4" />
                  Abrir horario
                </button>
              </form>
              {slotRows.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-border">
                  {slotRows.slice(0, 8).map(slot => (
                    <div key={slot.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0">
                      <span className="text-foreground">{new Date(slot.starts_at).toLocaleString('pt-BR')} até {new Date(slot.ends_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${slot.booked_by ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{slot.booked_by ? 'Reservado' : 'Livre'}</span>
                        {!slot.booked_by && <form action={deleteSlot}><input type="hidden" name="slot_id" value={slot.id} /><button className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></form>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid border-b border-border md:grid-cols-[240px_1fr]">
            <RowTitle title="Tarefas" description="Atribua atividades individuais." />
            <form action={createTask} className="grid gap-5 py-6 md:pl-8 lg:grid-cols-2">
              <Field label="Aluno" required>
                <select name="student_id" required className={inputClass}>
                  <option value="">Selecione um aluno</option>
                  {studentRows.map(student => (
                    <option key={student.user_id} value={student.user_id}>
                      {student.profile?.full_name || student.access_email || student.user_id}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Titulo da tarefa" required><Input name="title" placeholder="Titulo da tarefa" required /></Field>
              <Field label="Prazo"><Input name="due_at" type="datetime-local" placeholder="Prazo" /></Field>
              <div className="lg:col-span-2">
                <Field label="Orientacoes"><textarea name="description" className={textareaClass} placeholder="Orientacoes para o aluno" /></Field>
              </div>
              <div className="lg:col-span-2">
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600">
                  <Plus className="h-4 w-4" />
                  Atribuir tarefa
                </button>
              </div>
            </form>
          </div>

          <div className="grid border-b border-border md:grid-cols-[240px_1fr]">
            <RowTitle title="Mentorados" description="Acompanhamento individual e notas privadas." />
            <div className="space-y-4 py-6 md:pl-8">
              {studentRows.length === 0 ? <p className="text-sm text-muted">Nenhum mentorado com acesso ainda.</p> : studentRows.map(student => {
                const sessionsForStudent = studentSessionRows.filter(session => session.student_id === student.user_id)
                const tasksForStudent = studentTaskRows.filter(task => task.student_id === student.user_id)
                const intakeForStudent = intakeRows.find(intake => intake.student_id === student.user_id)
                const notesForStudent = noteRows.filter(note => note.student_id === student.user_id)
                const completedTasks = tasksForStudent.filter(task => task.completed_at).length
                return (
                  <details key={student.user_id} className="group overflow-hidden rounded-xl border border-border bg-card">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
                      <div><p className="font-semibold text-foreground">{student.profile?.full_name || student.access_email || 'Aluno'}</p><p className="mt-1 text-xs text-muted">{sessionsForStudent.length} sessões · {completedTasks}/{tasksForStudent.length} tarefas · {intakeForStudent ? 'diagnóstico enviado' : 'diagnóstico pendente'}</p></div>
                      <Users className="h-5 w-5 text-muted transition group-open:text-orange-500" />
                    </summary>
                    <div className="grid gap-5 border-t border-border bg-surface/60 p-5 lg:grid-cols-2">
                      <section className="rounded-xl bg-card p-4 ring-1 ring-border">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><CalendarClock className="h-4 w-4 text-orange-500" />Sessões</h4>
                        <div className="mt-3 space-y-2">
                          {sessionsForStudent.length === 0 ? <p className="text-xs text-muted">Nenhuma sessão individual.</p> : sessionsForStudent.map(session => (
                            <form key={session.id} action={updateStudentSession} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                              <input type="hidden" name="session_id" value={session.id} />
                              <div><p className="text-sm font-medium text-foreground">{session.title}</p><p className="text-xs text-muted">{session.scheduled_at ? new Date(session.scheduled_at).toLocaleString('pt-BR') : 'Sem data'} · {session.reschedule_count || 0} reagendamentos</p></div>
                              <select name="status" defaultValue={session.status} className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
                                <option value="scheduled">Agendada</option><option value="done">Realizada</option><option value="missed">Falta</option><option value="cancelled">Cancelada</option>
                              </select>
                              <button className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white">Salvar</button>
                            </form>
                          ))}
                        </div>
                      </section>
                      <section className="rounded-xl bg-card p-4 ring-1 ring-border">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Tarefas</h4>
                        <div className="mt-3 space-y-2">{tasksForStudent.length === 0 ? <p className="text-xs text-muted">Nenhuma tarefa.</p> : tasksForStudent.map(task => <div key={task.id} className="rounded-lg border border-border p-3"><p className="text-sm font-medium text-foreground">{task.title}</p><p className="mt-1 text-xs text-muted">{task.completed_at ? 'Concluída' : task.due_at ? `Prazo: ${new Date(task.due_at).toLocaleString('pt-BR')}` : 'Pendente'}</p></div>)}</div>
                      </section>
                      <section className="rounded-xl bg-card p-4 ring-1 ring-border lg:col-span-2">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><FileLock2 className="h-4 w-4 text-violet-500" />Notas privadas do mentor</h4>
                        <p className="mt-1 text-xs text-muted">Visíveis somente para o proprietário desta mentoria.</p>
                        <form action={addPrivateNote} className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="student_id" value={student.user_id} /><textarea name="body" required maxLength={10000} className={`${textareaClass} min-h-20 flex-1`} placeholder="Registre contexto, decisões e próximos passos..." /><button className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">Adicionar nota</button></form>
                        <div className="mt-3 space-y-2">{notesForStudent.map(note => <div key={note.id} className="flex items-start justify-between gap-3 rounded-lg bg-violet-50/60 p-3"><div><p className="whitespace-pre-wrap text-sm text-foreground">{note.body}</p><p className="mt-1 text-[10px] text-muted">{new Date(note.created_at).toLocaleString('pt-BR')}</p></div><form action={deletePrivateNote}><input type="hidden" name="note_id" value={note.id} /><button className="p-1 text-muted hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button></form></div>)}</div>
                      </section>
                    </div>
                  </details>
                )
              })}
            </div>
          </div>

          <div className="grid border-b border-border md:grid-cols-[240px_1fr]">
            <RowTitle title="Diagnosticos" description="Respostas dos alunos." />
            <div className="py-6 md:pl-8">
              {intakeRows.length === 0 ? (
                <p className="text-sm text-muted">Nenhum aluno respondeu o diagnostico ainda.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  {intakeRows.slice(0, 6).map((intake) => (
                    <div key={intake.student_id} className="border-b border-border p-4 last:border-b-0">
                      <p className="text-sm font-semibold text-foreground">{intake.profile?.full_name || 'Aluno'}</p>
                      <div className="mt-2 space-y-1">
                        {Object.entries(intake.answers || {}).slice(0, 4).map(([key, value]) => (
                          <p key={key} className="text-xs text-muted">{String(value)}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

const inputClass = 'h-12 w-full rounded-xl border-0 bg-surface px-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted focus:bg-card focus:ring-2 focus:ring-orange-500/20'
const textareaClass = 'min-h-24 w-full resize-y rounded-xl border-0 bg-surface px-4 py-3 text-sm font-medium text-foreground outline-none transition placeholder:text-muted focus:bg-card focus:ring-2 focus:ring-orange-500/20'

function ProductTabs({ productId, active }: { productId: string; active: string }) {
  const tabs = [
    { href: `/dashboard/products/${productId}`, label: 'Detalhes', icon: Building2, key: 'details' },
    { href: `/dashboard/products/${productId}/plans`, label: 'Planos', icon: CreditCard, key: 'plans' },
    { href: `/dashboard/products/${productId}/content`, label: 'Conteudo', icon: BookOpen, key: 'content' },
    { href: `/dashboard/products/${productId}/journey`, label: 'Mentoria', icon: Users, key: 'journey' },
    { href: `/dashboard/products/${productId}/checkout-editor`, label: 'Checkout', icon: Palette, key: 'checkout' },
    { href: `/dashboard/products/${productId}/order-bumps`, label: 'Order Bumps', icon: ShoppingBag, key: 'order-bumps' },
  ]
  return (
    <div className="mt-8 flex gap-2 overflow-x-auto border-b border-border">
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = tab.key === active
        return (
          <Link key={tab.key} href={tab.href} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${isActive ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted hover:text-foreground'}`}>
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}

function RowTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-6 md:pr-8">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

function Field({ label, required = false, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">
        {label}{required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-5 text-muted">{hint}</span>}
    </label>
  )
}

function Input({ name, placeholder, type = 'text', defaultValue = '', required = false }: { name: string; placeholder: string; type?: string; defaultValue?: string; required?: boolean }) {
  return <input name={name} type={type} required={required} defaultValue={defaultValue} className={inputClass} placeholder={placeholder} />
}
