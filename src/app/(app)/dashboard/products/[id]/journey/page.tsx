import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Building2, CheckCircle2, CreditCard, ExternalLink, Palette, Plus, Route, ShoppingBag, Trash2, Users } from 'lucide-react'
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
  booked_by: string | null
}

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

  const { data: program } = await supabase.from('mentorship_programs').select('*').eq('product_id', id).maybeSingle()
  const { data: sessions } = await supabase.from('mentorship_sessions').select('*').eq('product_id', id).is('student_id', null).order('sort_order', { ascending: true })
  const { data: students } = await supabase.from('student_access').select('user_id, access_email, granted_at, profile:profiles(full_name)').eq('product_id', id).order('granted_at', { ascending: false })
  const { data: slots } = await supabase.from('mentorship_availability_slots').select('*').eq('product_id', id).gte('starts_at', getRecentStartDateIso()).order('starts_at', { ascending: true })
  const { data: intakeResponses } = await supabase.from('mentorship_intake_responses').select('student_id, answers, submitted_at, profile:profiles(full_name)').eq('product_id', id).order('submitted_at', { ascending: false })

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
      intake_questions: String(formData.get('intake_questions') || '').split('\n').map(question => question.trim()).filter(Boolean),
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
      const { data: access } = await admin.from('student_access').select('access_email').eq('product_id', id).eq('user_id', studentId).maybeSingle()
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
  const intakeQuestions = Array.isArray(program?.intake_questions) ? program.intake_questions.join('\n') : ''

  return (
    <section className="overflow-hidden rounded-[10px] bg-white px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href={`/dashboard/products/${id}`} className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Mentoria</h2>
            <p className="mt-2 text-sm text-slate-400">Configure diagnostico, agenda, tarefas e sessoes de {product.name}.</p>
          </div>
        </div>
      </div>

      <ProductTabs productId={id} active="journey" />

      {!isMentorship ? (
        <div className="mt-10 grid border-y border-slate-200 md:grid-cols-[240px_1fr]">
          <RowTitle title="Indisponivel" description="Produto nao e mentoria." />
          <div className="py-6 md:pl-8">
            <p className="max-w-2xl text-sm leading-6 text-slate-500">Altere o tipo para Mentoria / Coaching nos detalhes do produto para usar esta area.</p>
          </div>
        </div>
      ) : (
        <div className="mt-10 max-w-6xl">
          <div className="grid border-y border-slate-200 md:grid-cols-[240px_1fr]">
            <RowTitle title="Resumo" description="Jornada da mentoria." />
            <div className="grid gap-6 py-6 md:grid-cols-4 md:pl-8">
              <Metric label="Etapas" value={sessionRows.length} />
              <Metric label="Alunos" value={studentRows.length} />
              <Metric label="Horarios" value={slotRows.length} />
              <Metric label="Diagnosticos" value={intakeRows.length} />
            </div>
          </div>

          <div className="grid border-b border-slate-200 md:grid-cols-[240px_1fr]">
            <RowTitle title="Programa" description="Promessa, formato e diagnostico." />
            <form action={saveProgram} className="grid gap-5 py-6 md:pl-8 lg:grid-cols-2">
              <Field label="Headline da jornada"><Input name="headline" defaultValue={program?.headline || ''} placeholder={product.name} /></Field>
              <Field label="Link padrao Zoom/Meet"><Input name="meeting_url" defaultValue={program?.meeting_url || ''} placeholder="https://..." /></Field>
              <Field label="Sessoes"><Input name="session_count" type="number" defaultValue={String(program?.session_count || 4)} placeholder="4" /></Field>
              <Field label="Duracao por sessao"><Input name="session_duration_minutes" type="number" defaultValue={String(program?.session_duration_minutes || 60)} placeholder="60" /></Field>
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

          <div className="grid border-b border-slate-200 md:grid-cols-[240px_1fr]">
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
                <div className="rounded-lg border border-dashed border-slate-200 px-6 py-12 text-center">
                  <Route className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm text-slate-400">Crie as etapas da jornada: diagnostico, estrategia, execucao e revisao.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  {sessionRows.map((session, index) => (
                    <div key={session.id} className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 last:border-b-0">
                      <div className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 font-semibold text-orange-600">{index + 1}</div>
                        <div>
                          <h3 className="font-semibold text-slate-950">{session.title}</h3>
                          {session.description && <p className="mt-1 text-sm text-slate-400">{session.description}</p>}
                          {session.meeting_url && (
                            <a href={session.meeting_url} target="_blank" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-orange-600">
                              Link da sessao <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                      <form action={deleteSession}>
                        <input type="hidden" name="session_id" value={session.id} />
                        <button className="rounded-xl p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid border-b border-slate-200 md:grid-cols-[240px_1fr]">
            <RowTitle title="Agenda" description="Horarios disponiveis." />
            <div className="space-y-5 py-6 md:pl-8">
              <form action={createSlot} className="grid gap-5 lg:grid-cols-[1fr_160px_1fr_auto] lg:items-end">
                <Field label="Inicio" required><Input name="starts_at" type="datetime-local" placeholder="Inicio" required /></Field>
                <Field label="Duracao"><Input name="duration_minutes" type="number" placeholder="60" defaultValue={String(program?.session_duration_minutes || 60)} /></Field>
                <Field label="Link da sala"><Input name="meeting_url" placeholder="https://..." defaultValue={program?.meeting_url || ''} /></Field>
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-5 text-sm font-semibold text-orange-600 transition hover:bg-orange-100">
                  <Plus className="h-4 w-4" />
                  Abrir horario
                </button>
              </form>
              {slotRows.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  {slotRows.slice(0, 8).map(slot => (
                    <div key={slot.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
                      <span className="text-slate-700">{new Date(slot.starts_at).toLocaleString('pt-BR')}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${slot.booked_by ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {slot.booked_by ? 'Reservado' : 'Livre'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid border-b border-slate-200 md:grid-cols-[240px_1fr]">
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

          <div className="grid border-b border-slate-200 md:grid-cols-[240px_1fr]">
            <RowTitle title="Diagnosticos" description="Respostas dos alunos." />
            <div className="py-6 md:pl-8">
              {intakeRows.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum aluno respondeu o diagnostico ainda.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  {intakeRows.slice(0, 6).map((intake) => (
                    <div key={intake.student_id} className="border-b border-slate-100 p-4 last:border-b-0">
                      <p className="text-sm font-semibold text-slate-950">{intake.profile?.full_name || 'Aluno'}</p>
                      <div className="mt-2 space-y-1">
                        {Object.entries(intake.answers || {}).slice(0, 4).map(([key, value]) => (
                          <p key={key} className="text-xs text-slate-500">{String(value)}</p>
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

const inputClass = 'h-12 w-full rounded-xl border-0 bg-[#f4f4f6] px-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-orange-500/20'
const textareaClass = 'min-h-24 w-full resize-y rounded-xl border-0 bg-[#f4f4f6] px-4 py-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-orange-500/20'

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
    <div className="mt-8 flex gap-2 overflow-x-auto border-b border-slate-200">
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = tab.key === active
        return (
          <Link key={tab.key} href={tab.href} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${isActive ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
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
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function Field({ label, required = false, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-5 text-slate-400">{hint}</span>}
    </label>
  )
}

function Input({ name, placeholder, type = 'text', defaultValue = '', required = false }: { name: string; placeholder: string; type?: string; defaultValue?: string; required?: boolean }) {
  return <input name={name} type={type} required={required} defaultValue={defaultValue} className={inputClass} placeholder={placeholder} />
}
