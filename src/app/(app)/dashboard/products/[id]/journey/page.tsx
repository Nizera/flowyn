import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Flame,
  Palette,
  Plus,
  Route,
  Target,
  Trash2,
  Users,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getResendClient } from '@/lib/resend'
import { learningNotificationEmail } from '@/lib/email-templates'

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

  const { data: program } = await supabase
    .from('mentorship_programs')
    .select('*')
    .eq('product_id', id)
    .maybeSingle()

  const { data: sessions } = await supabase
    .from('mentorship_sessions')
    .select('*')
    .eq('product_id', id)
    .is('student_id', null)
    .order('sort_order', { ascending: true })

  const { data: students } = await supabase
    .from('student_access')
    .select('user_id, access_email, granted_at, profile:profiles(full_name)')
    .eq('product_id', id)
    .order('granted_at', { ascending: false })

  const { data: slots } = await supabase
    .from('mentorship_availability_slots')
    .select('*')
    .eq('product_id', id)
    .gte('starts_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('starts_at', { ascending: true })

  const { data: intakeResponses } = await supabase
    .from('mentorship_intake_responses')
    .select('student_id, answers, submitted_at, profile:profiles(full_name)')
    .eq('product_id', id)
    .order('submitted_at', { ascending: false })

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
      meeting_url: String(formData.get('meeting_url') || '').trim() || null,
      intake_questions: String(formData.get('intake_questions') || '')
        .split('\n')
        .map(question => question.trim())
        .filter(Boolean),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'product_id' })

    revalidatePath(`/dashboard/products/${id}/journey`)
  }

  async function createSession(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const title = String(formData.get('title') || '').trim()
    if (!title) return

    const { count } = await supabase
      .from('mentorship_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id)
      .is('student_id', null)

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

  async function createSlot(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const startsAt = String(formData.get('starts_at') || '')
    const duration = Number(formData.get('duration_minutes') || 60) || 60
    if (!startsAt) return

    const startDate = new Date(startsAt)
    await supabase.from('mentorship_availability_slots').insert({
      product_id: id,
      starts_at: startDate.toISOString(),
      ends_at: new Date(startDate.getTime() + duration * 60 * 1000).toISOString(),
      meeting_url: String(formData.get('meeting_url') || '').trim() || null,
    })

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
      const { data: access } = await admin
        .from('student_access')
        .select('access_email')
        .eq('product_id', id)
        .eq('user_id', studentId)
        .maybeSingle()
      const { data: product } = await admin.from('products').select('name').eq('id', id).single()
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

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
  const sessionRows = (sessions || []) as any[]
  const studentRows = (students || []).filter((row: any) => row.user_id) as any[]
  const slotRows = (slots || []) as any[]
  const intakeRows = (intakeResponses || []) as any[]
  const intakeQuestions = Array.isArray(program?.intake_questions) ? program.intake_questions.join('\n') : ''

  return (
    <div className="w-full pb-12">
      <main className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center gap-4">
          <Link href={`/dashboard/products/${id}`} className="rounded-xl border border-white/10 bg-[#111] p-2.5 transition hover:bg-white/5">
            <ArrowLeft className="h-5 w-5 text-white/70" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">Mentoria: {product.name}</h1>
            <p className="mt-1 text-sm text-white/50">Crie uma jornada com diagnóstico, sessões e próximos passos.</p>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#111] p-2">
          <Link href={`/dashboard/products/${id}`} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white">
            Detalhes
          </Link>
          <Link href={`/dashboard/products/${id}/plans`} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white">
            Planos
          </Link>
          <Link href={`/dashboard/products/${id}/content`} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white">
            Conteúdo
          </Link>
          <Link href={`/dashboard/products/${id}/journey`} className="rounded-xl border border-white/5 bg-white/10 px-5 py-2.5 text-sm font-bold text-white">
            Mentoria
          </Link>
          <Link href={`/dashboard/products/${id}/checkout-editor`} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white">
            <Palette className="mr-2 inline h-4 w-4" /> Checkout
          </Link>
        </div>

        {!isMentorship ? (
          <div className="rounded-3xl border border-amber-500/25 bg-amber-500/10 p-8">
            <h2 className="text-xl font-black text-white">Este produto não está marcado como mentoria</h2>
            <p className="mt-2 text-sm text-amber-100/75">
              Altere o tipo para Mentoria / Coaching nos detalhes do produto para usar o Flowyn Journey.
            </p>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-5">
            <section className="lg:col-span-3 space-y-5">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#111]">
                <div className="relative min-h-[280px] bg-black">
                  {product.cover_url ? (
                    <img src={product.cover_url} alt={product.name} className="absolute inset-0 h-full w-full object-cover opacity-55" />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(0,232,138,0.28),transparent_30%),linear-gradient(135deg,#151515,#050505)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/45 to-transparent" />
                  <div className="relative flex min-h-[280px] flex-col justify-end p-8">
                    <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-[#00e88a]">
                      <Route className="h-3.5 w-3.5" />
                      Flowyn Journey
                    </div>
                    <h2 className="max-w-2xl text-3xl font-black text-white">{program?.headline || product.name}</h2>
                    <p className="mt-2 max-w-xl text-sm text-white/65">{program?.promise || product.short_description || 'Transforme chamadas em uma jornada clara, acompanhável e orientada a resultado.'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#111] p-6">
                <h2 className="flex items-center gap-2 text-lg font-black text-white">
                  <Target className="h-5 w-5 text-[#00e88a]" />
                  Mapa da transformação
                </h2>
                <div className="mt-6 space-y-4">
                  {sessionRows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/45">
                      Crie as etapas da jornada: diagnóstico, estratégia, execução e revisão.
                    </div>
                  ) : (
                    sessionRows.map((session, index) => (
                      <div key={session.id} className="relative rounded-2xl border border-white/10 bg-black/20 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#00e88a]/10 font-black text-[#00e88a]">
                              {index + 1}
                            </div>
                            <div>
                              <h3 className="font-black text-white">{session.title}</h3>
                              {session.description && <p className="mt-1 text-sm text-white/45">{session.description}</p>}
                              {session.meeting_url && (
                                <a href={session.meeting_url} target="_blank" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#00e88a]">
                                  Link da sessão <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                          <form action={deleteSession}>
                            <input type="hidden" name="session_id" value={session.id} />
                            <button className="rounded-xl p-2 text-white/30 transition hover:bg-red-500/10 hover:text-red-300">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </form>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <aside className="lg:col-span-2 space-y-5">
              <form action={saveProgram} className="rounded-3xl border border-white/10 bg-[#111] p-6">
                <h2 className="flex items-center gap-2 text-lg font-black text-white">
                  <Flame className="h-5 w-5 text-[#00e88a]" />
                  Programa
                </h2>
                <div className="mt-5 space-y-3">
                  <Input name="headline" placeholder="Headline da jornada" defaultValue={program?.headline || ''} />
                  <textarea name="promise" placeholder="Promessa e resultado esperado" defaultValue={program?.promise || ''} className="min-h-24 w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#00e88a]" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input name="session_count" type="number" placeholder="Sessões" defaultValue={String(program?.session_count || 4)} />
                    <Input name="session_duration_minutes" type="number" placeholder="Minutos" defaultValue={String(program?.session_duration_minutes || 60)} />
                  </div>
                  <Input name="meeting_url" placeholder="Link padrão Zoom/Meet" defaultValue={program?.meeting_url || ''} />
                  <textarea name="intake_questions" placeholder="Perguntas de diagnóstico, uma por linha" defaultValue={intakeQuestions} className="min-h-28 w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#00e88a]" />
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00e88a] px-4 py-3 text-sm font-black text-black transition hover:bg-[#04f294]">
                    <CheckCircle2 className="h-4 w-4" />
                    Salvar jornada
                  </button>
                </div>
              </form>

              <form action={createSession} className="rounded-3xl border border-white/10 bg-[#111] p-6">
                <h2 className="flex items-center gap-2 text-lg font-black text-white">
                  <CalendarClock className="h-5 w-5 text-[#00e88a]" />
                  Nova etapa
                </h2>
                <div className="mt-5 space-y-3">
                  <Input name="title" placeholder="Ex: Diagnóstico inicial" required />
                  <textarea name="description" placeholder="Objetivo desta etapa" className="min-h-24 w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#00e88a]" />
                  <Input name="meeting_url" placeholder="Link específico da sessão" />
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#00e88a]/30 bg-[#00e88a]/10 px-4 py-3 text-sm font-black text-[#00e88a] transition hover:bg-[#00e88a]/15">
                    <Plus className="h-4 w-4" />
                    Adicionar etapa
                  </button>
                </div>
              </form>

              <form action={createSlot} className="rounded-3xl border border-white/10 bg-[#111] p-6">
                <h2 className="flex items-center gap-2 text-lg font-black text-white">
                  <CalendarClock className="h-5 w-5 text-[#00e88a]" />
                  Agenda disponível
                </h2>
                <div className="mt-5 space-y-3">
                  <Input name="starts_at" type="datetime-local" placeholder="Início" required />
                  <Input name="duration_minutes" type="number" placeholder="Duração em minutos" defaultValue={String(program?.session_duration_minutes || 60)} />
                  <Input name="meeting_url" placeholder="Link da sala" defaultValue={program?.meeting_url || ''} />
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#00e88a]/30 bg-[#00e88a]/10 px-4 py-3 text-sm font-black text-[#00e88a] transition hover:bg-[#00e88a]/15">
                    <Plus className="h-4 w-4" />
                    Abrir horário
                  </button>
                </div>
                {slotRows.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {slotRows.slice(0, 4).map(slot => (
                      <div key={slot.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/50">
                        {new Date(slot.starts_at).toLocaleString('pt-BR')} {slot.booked_by ? '· reservado' : '· livre'}
                      </div>
                    ))}
                  </div>
                )}
              </form>

              <form action={createTask} className="rounded-3xl border border-white/10 bg-[#111] p-6">
                <h2 className="flex items-center gap-2 text-lg font-black text-white">
                  <CheckCircle2 className="h-5 w-5 text-[#00e88a]" />
                  Tarefa para aluno
                </h2>
                <div className="mt-5 space-y-3">
                  <select name="student_id" required className="w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white outline-none focus:border-[#00e88a]">
                    <option value="">Selecione um aluno</option>
                    {studentRows.map(student => (
                      <option key={student.user_id} value={student.user_id}>
                        {student.profile?.full_name || student.access_email || student.user_id}
                      </option>
                    ))}
                  </select>
                  <Input name="title" placeholder="Título da tarefa" required />
                  <textarea name="description" placeholder="Orientações" className="min-h-24 w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#00e88a]" />
                  <Input name="due_at" type="datetime-local" placeholder="Prazo" />
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00e88a] px-4 py-3 text-sm font-black text-black transition hover:bg-[#04f294]">
                    <Plus className="h-4 w-4" />
                    Atribuir tarefa
                  </button>
                </div>
              </form>

              <div className="rounded-3xl border border-white/10 bg-[#111] p-6">
                <h2 className="flex items-center gap-2 text-lg font-black text-white">
                  <Users className="h-5 w-5 text-[#00e88a]" />
                  Experiência única
                </h2>
                <p className="mt-3 text-sm text-white/50">
                  O aluno não compra apenas chamadas: ele visualiza a jornada, sabe onde está e acompanha próximos passos.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#111] p-6">
                <h2 className="flex items-center gap-2 text-lg font-black text-white">
                  <Target className="h-5 w-5 text-[#00e88a]" />
                  Diagnósticos recebidos
                </h2>
                <div className="mt-4 space-y-3">
                  {intakeRows.length === 0 ? (
                    <p className="text-sm text-white/35">Nenhum aluno respondeu o diagnóstico ainda.</p>
                  ) : (
                    intakeRows.slice(0, 4).map((intake) => (
                      <div key={intake.student_id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-sm font-bold text-white">{intake.profile?.full_name || 'Aluno'}</p>
                        <div className="mt-2 space-y-1">
                          {Object.entries(intake.answers || {}).slice(0, 3).map(([key, value]) => (
                            <p key={key} className="text-xs text-white/45">{String(value)}</p>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}

function Input({
  name,
  placeholder,
  type = 'text',
  defaultValue = '',
  required = false,
}: {
  name: string
  placeholder: string
  type?: string
  defaultValue?: string
  required?: boolean
}) {
  return (
    <input
      name={name}
      type={type}
      required={required}
      defaultValue={defaultValue}
      className="w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#00e88a]"
      placeholder={placeholder}
    />
  )
}
