import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Layers3,
  MessageCircle,
  Paperclip,
  Play,
  Route,
  Target,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { claimPendingStudentAccess } from '@/lib/student-access'
import { addLessonComment, bookMentorshipSlot, cancelMentorshipSession, rescheduleMentorshipSession, saveIntakeResponses, toggleLessonProgress, toggleMentorshipTask } from './actions'

export const dynamic = 'force-dynamic'

function getCurrentTimestamp() {
  return Date.now()
}

type Product = {
  id: string
  name: string
  short_description?: string | null
  description?: string | null
  cover_url?: string | null
  product_type?: string | null
  category?: string | null
  owner?: { full_name?: string | null }
}

export default async function LearnProductPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ lesson?: string }>
}) {
  const { id } = await props.params
  const { lesson: selectedLessonId } = await props.searchParams
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  await claimPendingStudentAccess(user.id, user.email)

  const admin = createAdminClient()
  const { data: access } = await admin
    .from('student_access')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_id', id)
    .is('revoked_at', null)
    .maybeSingle()

  if (!access) redirect('/learn')

  await admin
    .from('student_access')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('product_id', id)

  const { data: product } = await admin
    .from('products')
    .select('id, name, short_description, description, cover_url, product_type, category, owner:profiles(full_name)')
    .eq('id', id)
    .single()

  if (!product) redirect('/learn')

  type Product = {
    id: string
    name: string
    short_description?: string | null
    description?: string | null
    cover_url?: string | null
    product_type?: string | null
    category?: string | null
    owner?: { full_name?: string | null }
  }

  if ((product as Product).product_type === 'mentoria') {
    return <MentorshipExperience product={product as Product} userId={user.id} />
  }

  return <CourseExperience product={product as Product} userId={user.id} selectedLessonId={selectedLessonId} />
}

async function CourseExperience({ product, userId, selectedLessonId }: { product: Product; userId: string; selectedLessonId?: string }) {
  type Module = { id: string; title?: string; lessons?: Lesson[] }
  type Lesson = {
    id: string
    title?: string
    description?: string | null
    duration_minutes?: number | null
    sort_order?: number | null
    video_file_path?: string | null
    video_url?: string | null
    material_file_paths?: string[] | null
    content_url?: string | null
  }
  type ProgressRow = { lesson_id: string; completed_at?: string | null }
  type Comment = { id: string; body: string; created_at: string; user?: { full_name?: string } }
  type Certificate = { certificate_code?: string }

  const admin = createAdminClient()
  const { data: modules } = await admin
    .from('course_modules')
    .select('id, title, sort_order, product_id, lessons:course_lessons(id, title, description, duration_minutes, sort_order, video_file_path, video_url, material_file_paths, content_url)')
    .eq('product_id', product.id)
    .order('sort_order', { ascending: true })

  const { data: progressRows } = await admin
    .from('lesson_progress')
    .select('lesson_id, completed_at')
    .eq('user_id', userId)
    .eq('product_id', product.id)

  const completedLessonIds = new Set((progressRows || []).filter((row: ProgressRow) => row.completed_at).map((row: ProgressRow) => row.lesson_id))
  const moduleRows = (modules || []) as Module[]
  const lessons = moduleRows.flatMap(module => [...(module.lessons || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)))
  const activeLesson = lessons.find(lesson => lesson.id === selectedLessonId)
    || lessons.find(lesson => !completedLessonIds.has(lesson.id))
    || lessons[0]
  const activeLessonIndex = activeLesson ? lessons.findIndex(lesson => lesson.id === activeLesson.id) : -1
  const nextLesson = activeLessonIndex >= 0 ? lessons[activeLessonIndex + 1] : null
  const progressPercent = lessons.length > 0 ? Math.round((completedLessonIds.size / lessons.length) * 100) : 0
  let signedVideoUrl: string | null = null
  const signedMaterials: Array<{ label: string; url: string }> = []

  if (activeLesson?.video_file_path) {
    const { data: signed } = await admin.storage
      .from('product-files')
      .createSignedUrl(activeLesson.video_file_path, 60 * 60 * 2)
    signedVideoUrl = signed?.signedUrl || null
  }

  if (Array.isArray(activeLesson?.material_file_paths)) {
    for (const path of activeLesson.material_file_paths) {
      const { data: signed } = await admin.storage
        .from('product-files')
        .createSignedUrl(path, 60 * 60 * 2)
      if (signed?.signedUrl) signedMaterials.push({ label: path.split('/').pop() || 'Material', url: signed.signedUrl })
    }
  }

  const { data: comments } = activeLesson
    ? await admin
        .from('lesson_comments')
        .select('id, body, created_at, user:profiles(full_name)')
        .eq('lesson_id', activeLesson.id)
        .order('created_at', { ascending: true })
    : { data: [] }

  let certificate: Certificate | null = null
  if (lessons.length > 0 && completedLessonIds.size === lessons.length) {
    const { data } = await admin
      .from('course_certificates')
      .upsert({ product_id: product.id, user_id: userId }, { onConflict: 'product_id,user_id' })
      .select('id, product_id, user_id, certificate_code, issued_at, created_at')
      .single()
    certificate = data
  } else {
    const { data } = await admin
      .from('course_certificates')
      .select('id, product_id, user_id, certificate_code, issued_at, created_at')
      .eq('user_id', userId)
      .maybeSingle()
    certificate = data
  }

  const hasMaterials = Boolean(activeLesson?.content_url) || signedMaterials.length > 0

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_70%_0%,rgba(249,115,22,0.07),transparent_24%),#080808] text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-xl">
        <div className="mx-auto grid h-20 max-w-[1600px] grid-cols-[1fr_auto] items-center gap-4 px-4 md:grid-cols-[1fr_auto_1fr] md:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/learn" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-white/55 transition hover:border-white/25 hover:text-white md:px-4 md:text-sm">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar aos meus acessos</span>
            </Link>
            <Link href="/learn" className="hidden items-center gap-2 xl:flex">
              <img src="/brand/logo-dark.png" alt="Flowyn" className="h-8 w-auto" />
              <span className="font-black text-orange-500">Play</span>
            </Link>
          </div>
          <div className="hidden min-w-0 text-center md:block">
            <p className="truncate text-sm font-black text-white/85">{product.name}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">{lessons.length} {lessons.length === 1 ? 'aula' : 'aulas'}</p>
          </div>
          <div className="ml-auto w-32 sm:w-48">
            <div className="flex items-center justify-between text-[10px] font-bold sm:text-xs">
              <span className="hidden text-white/40 sm:inline">Progresso</span>
              <span className="ml-auto text-orange-400">{progressPercent}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-600 to-amber-400 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-8 md:py-7">
        <header className="hidden">
          <div>
            <Link href="/learn" className="inline-flex items-center gap-2 text-sm font-bold text-white/45 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Meus acessos
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-orange-400">
                Flowyn Play
              </span>
              <span className="text-xs font-semibold text-white/35">{lessons.length} {lessons.length === 1 ? 'aula' : 'aulas'}</span>
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight md:text-4xl">{product.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">{product.short_description || product.description}</p>
          </div>

          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-white/65">Seu progresso</span>
              <span className="font-black text-orange-400">{progressPercent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-600 to-amber-400 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="mt-2 text-xs text-white/35">{completedLessonIds.size} de {lessons.length} aulas concluídas</p>
          </div>
        </header>

        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101010] shadow-2xl shadow-black/40 md:rounded-[1.75rem]">
              <div className="relative aspect-video overflow-hidden bg-black">
                {signedVideoUrl ? (
                  <video controls playsInline preload="metadata" className="h-full w-full bg-black object-contain" src={signedVideoUrl} poster={product.cover_url || undefined} />
                ) : activeLesson?.video_url && activeLesson.video_url.startsWith('https://') ? (
                  <iframe
                    src={activeLesson.video_url}
                    title={activeLesson.title}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : product.cover_url ? (
                  <div className="relative h-full w-full">
                    <img src={product.cover_url} alt={product.name} className="h-full w-full object-cover opacity-45" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/25" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-black/55 backdrop-blur-md">
                        <Play className="ml-1 h-8 w-8 fill-orange-500 text-orange-500" />
                      </div>
                      <p className="mt-4 text-sm font-bold text-white/70">Esta aula ainda não possui vídeo</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(249,115,22,0.2),transparent_30%),linear-gradient(135deg,#171717,#050505)] text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-orange-500/20 bg-orange-500/10">
                      <Play className="ml-1 h-8 w-8 fill-orange-500 text-orange-500" />
                    </div>
                    <p className="mt-4 text-sm font-bold text-white/55">Esta aula ainda não possui vídeo</p>
                  </div>
                )}
                <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-orange-400 backdrop-blur-md">
                  Flowyn Play
                </div>
              </div>

              <div className="p-5 md:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-400">
                      Aula {activeLessonIndex + 1} de {lessons.length}
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">{activeLesson?.title || product.name}</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">{activeLesson?.description || product.short_description || product.description}</p>
                  </div>
                  {activeLesson?.duration_minutes && (
                    <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/[0.06] px-3 py-2 text-xs font-bold text-white/50">
                      <Clock3 className="h-3.5 w-3.5" />
                      {activeLesson.duration_minutes} min
                    </span>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:flex-wrap">
                  {activeLesson && (
                    <form action={toggleLessonProgress.bind(null, product.id, activeLesson.id, !completedLessonIds.has(activeLesson.id))}>
                      <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-black transition hover:bg-orange-400 sm:w-auto">
                        {completedLessonIds.has(activeLesson.id) ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                        {completedLessonIds.has(activeLesson.id) ? 'Aula concluída' : 'Marcar como concluída'}
                      </button>
                    </form>
                  )}
                  {nextLesson && (
                    <Link href={`/learn/${product.id}?lesson=${nextLesson.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white/80 transition hover:border-white/30 hover:bg-white/[0.06] hover:text-white">
                      Próxima aula
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-[#101010] p-5 md:p-6">
                <h3 className="flex items-center gap-2 text-base font-black">
                  <Paperclip className="h-4 w-4 text-orange-400" />
                  Materiais da aula
                </h3>
                <div className="mt-4 space-y-2">
                  {!hasMaterials && <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/35">Nenhum material complementar nesta aula.</p>}
                  {activeLesson?.content_url && (
                    <a href={activeLesson.content_url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm font-bold text-white/70 transition hover:border-orange-500/40 hover:text-white">
                      <span className="flex items-center gap-3"><ExternalLink className="h-4 w-4 text-orange-400" /> Material complementar</span>
                      <ChevronRight className="h-4 w-4 text-white/25" />
                    </a>
                  )}
                  {signedMaterials.map(material => (
                    <a key={material.url} href={material.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm font-bold text-white/70 transition hover:border-orange-500/40 hover:text-white">
                      <span className="flex min-w-0 items-center gap-3"><Download className="h-4 w-4 shrink-0 text-orange-400" /><span className="truncate">{material.label}</span></span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
                    </a>
                  ))}
                </div>
              </section>

              {certificate ? (
                <section className="rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-500/15 to-amber-400/[0.04] p-5 md:p-6">
                  <CheckCircle2 className="h-7 w-7 text-orange-400" />
                  <h3 className="mt-4 text-lg font-black">Certificado liberado</h3>
                  <p className="mt-2 text-sm text-white/45">Você concluiu todas as aulas deste curso.</p>
                  <Link href={`/learn/${product.id}/certificate`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-black transition hover:bg-orange-100">
                    Ver certificado <ChevronRight className="h-4 w-4" />
                  </Link>
                </section>
              ) : (
                <section className="rounded-2xl border border-white/10 bg-[#101010] p-5 md:p-6">
                  <Layers3 className="h-7 w-7 text-orange-400" />
                  <h3 className="mt-4 text-lg font-black">Continue avançando</h3>
                  <p className="mt-2 text-sm leading-6 text-white/45">Conclua as aulas para liberar seu certificado ao final do curso.</p>
                </section>
              )}
            </div>

            {activeLesson && (
              <section className="mt-5 rounded-2xl border border-white/10 bg-[#101010] p-5 md:p-6">
                <h3 className="flex items-center gap-2 text-base font-black">
                  <MessageCircle className="h-4 w-4 text-orange-400" />
                  Comentários da aula
                </h3>
                <div className="mt-4 space-y-3">
                  {(comments || []).length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/35">Seja o primeiro a deixar uma dúvida ou comentário.</p>
                  ) : (
                    ((comments ?? []) as unknown as Comment[]).map((comment) => (
                      <div key={comment.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <p className="text-sm leading-6 text-white/75">{comment.body}</p>
                        <p className="mt-2 text-xs text-white/30">{comment.user?.full_name || 'Aluno'} · {new Date(comment.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                    ))
                  )}
                </div>
                <form action={addLessonComment.bind(null, product.id, activeLesson.id)} className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input name="body" required placeholder="Escreva uma dúvida ou comentário" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-orange-500/70" />
                  <button className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-black transition hover:bg-orange-400">Enviar</button>
                </form>
              </section>
            )}
          </div>

          <aside className="overflow-hidden rounded-2xl border border-white/10 bg-[#101010] xl:sticky xl:top-24">
            <div className="border-b border-white/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-400">Conteúdo do curso</p>
                  <h2 className="mt-1 text-lg font-black">Sua trilha de aulas</h2>
                </div>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-bold text-white/45">{progressPercent}%</span>
              </div>
            </div>

            <div className="max-h-[calc(100vh-11rem)] overflow-y-auto p-3">
              {moduleRows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-white/35">O conteúdo deste curso ainda está sendo preparado.</p>
              ) : moduleRows.map((module, moduleIndex) => {
                const sortedLessons = [...(module.lessons || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
                const moduleCompleted = sortedLessons.filter(lesson => completedLessonIds.has(lesson.id)).length
                const containsActiveLesson = sortedLessons.some(lesson => lesson.id === activeLesson?.id)
                return (
                  <details key={module.id} open={containsActiveLesson || moduleIndex === 0} className="group mb-2 overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-xs font-black text-orange-400">{moduleIndex + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black">{module.title || `Módulo ${moduleIndex + 1}`}</span>
                        <span className="mt-0.5 block text-[11px] text-white/30">{moduleCompleted}/{sortedLessons.length} concluídas</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-white/25 transition group-open:rotate-90" />
                    </summary>

                    <div className="space-y-1 border-t border-white/[0.06] p-2">
                      {sortedLessons.map((lesson, lessonIndex) => {
                        const completed = completedLessonIds.has(lesson.id)
                        const isActive = activeLesson?.id === lesson.id
                        return (
                          <div key={lesson.id} className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${isActive ? 'border-orange-500/40 bg-orange-500/10' : 'border-transparent hover:bg-white/[0.04]'}`}>
                            <form action={toggleLessonProgress.bind(null, product.id, lesson.id, !completed)}>
                              <button title={completed ? 'Marcar como não concluída' : 'Marcar como concluída'} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${completed ? 'border-orange-500 bg-orange-500 text-black' : 'border-white/15 text-white/35 hover:border-orange-500/60 hover:text-orange-400'}`}>
                                {completed ? <Check className="h-4 w-4" /> : <Play className="ml-0.5 h-3 w-3 fill-current" />}
                              </button>
                            </form>
                            <Link href={`/learn/${product.id}?lesson=${lesson.id}`} className="min-w-0 flex-1 py-1">
                              <p className={`truncate text-sm font-bold ${isActive ? 'text-white' : 'text-white/65'}`}>{lesson.title || `Aula ${lessonIndex + 1}`}</p>
                              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/30">
                                {lesson.duration_minutes ? <><Clock3 className="h-3 w-3" /> {lesson.duration_minutes} min</> : `Aula ${lessonIndex + 1}`}
                              </p>
                            </Link>
                            {isActive && <span className="h-2 w-2 shrink-0 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.8)]" />}
                          </div>
                        )
                      })}
                    </div>
                  </details>
                )
              })}
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}

async function MentorshipExperience({ product, userId }: { product: Product; userId: string }) {
  const now = getCurrentTimestamp()
  const admin = createAdminClient()
  const { data: program } = await admin
    .from('mentorship_programs')
    .select('id, headline, promise, session_duration_minutes, meeting_url, intake_questions, timezone, session_count, booking_min_notice_hours, cancellation_notice_hours, max_reschedules')
    .eq('product_id', product.id)
    .maybeSingle()

  const { data: individualSessions } = await admin
    .from('mentorship_sessions')
    .select('id, title, description, status, scheduled_at, ends_at, meeting_url, sort_order, reschedule_count')
    .eq('product_id', product.id)
    .eq('student_id', userId)
    .order('sort_order', { ascending: true })

  const { data: templateSessions } = await admin
    .from('mentorship_sessions')
    .select('id, title, description, status, scheduled_at, ends_at, sort_order, reschedule_count')
    .eq('product_id', product.id)
    .is('student_id', null)
    .order('sort_order', { ascending: true })

  const { data: tasks } = await admin
    .from('mentorship_tasks')
    .select('id, title, description, completed_at, due_at')
    .eq('product_id', product.id)
    .eq('student_id', userId)
    .order('created_at', { ascending: false })

  const { data: intake } = await admin
    .from('mentorship_intake_responses')
    .select('id, product_id, student_id, answers, submitted_at, created_at')
    .eq('product_id', product.id)
    .eq('student_id', userId)
    .maybeSingle()

  const { data: slots } = await admin
    .from('mentorship_availability_slots')
    .select('id, starts_at, ends_at')
    .eq('product_id', product.id)
    .is('booked_by', null)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(8)

  type SessionRow = { id: string; title?: string; description?: string; status?: string; scheduled_at?: string; ends_at?: string; meeting_url?: string | null; reschedule_count?: number }
  type TaskRow = { id: string; title?: string; description?: string; completed_at?: string | null; due_at?: string | null }
  type SlotRow = { id: string; starts_at: string; ends_at: string }

  const individualRows = (individualSessions || []) as SessionRow[]
  const plannedRows = individualRows.filter(session => session.status === 'planned')
  const sessionRows = (plannedRows.length ? plannedRows : (templateSessions || [])) as SessionRow[]
  const taskRows = (tasks || []) as TaskRow[]
  const completedTasks = taskRows.filter(task => task.completed_at).length
  const questions = Array.isArray(program?.intake_questions) ? program.intake_questions : []
  const answers = (intake?.answers || {}) as Record<string, string>
  const slotRows = (slots || []) as SlotRow[]
  const upcomingSession = individualRows
    .filter(session => session.status === 'scheduled' && session.scheduled_at && new Date(session.scheduled_at).getTime() > now)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())[0]
  const timezone = program?.timezone || 'America/Sao_Paulo'
  const canCancelUpcoming = Boolean(upcomingSession?.scheduled_at && new Date(upcomingSession.scheduled_at).getTime() >= now + Number(program?.cancellation_notice_hours ?? 24) * 3600000)
  const canRescheduleUpcoming = canCancelUpcoming && Number(upcomingSession?.reschedule_count || 0) < Number(program?.max_reschedules ?? 2)
  const completedStages = sessionRows.filter(session => session.status === 'done').length
  const totalProgressItems = sessionRows.length + taskRows.length
  const progressPercent = totalProgressItems ? Math.round(((completedStages + completedTasks) / totalProgressItems) * 100) : 0
  const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(value))

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_80%_0%,rgba(249,115,22,0.12),transparent_28%),#070707] pb-16 text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#070707]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/learn" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white/60 transition hover:border-white/25 hover:text-white"><ArrowLeft className="h-4 w-4" /> Meus acessos</Link>
          <div className="hidden items-center gap-2 sm:flex"><img src="/brand/logo-dark.png" alt="Flowyn" className="h-8 w-auto" /><span className="font-black text-orange-500">Journey</span></div>
          <div className="w-32 sm:w-52"><div className="flex justify-between text-xs font-bold text-white/45"><span>Progresso</span><span className="text-orange-400">{progressPercent}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-orange-600 to-amber-400" style={{ width: `${progressPercent}%` }} /></div></div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-8">

      <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-[#111] min-h-[360px]">
        {product.cover_url ? (
          <img src={product.cover_url} alt={product.name} className="absolute inset-0 h-full w-full object-cover opacity-50" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(249,115,22,0.25),transparent_32%),linear-gradient(135deg,#171717,#050505)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#111] via-[#111]/75 to-transparent" />
        <div className="relative flex min-h-[360px] max-w-3xl flex-col justify-end p-8 md:p-10">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-black/45 px-3 py-1 text-xs font-bold text-[#f97316]">
            <Route className="h-3.5 w-3.5" />
            Flowyn Journey
          </div>
          <h1 className="text-4xl font-black text-white md:text-5xl">{program?.headline || product.name}</h1>
          <p className="mt-4 text-sm leading-6 text-white/65">{program?.promise || product.short_description || product.description}</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-white/55"><span className="rounded-full border border-white/10 bg-black/35 px-3 py-2">{sessionRows.length} etapas</span><span className="rounded-full border border-white/10 bg-black/35 px-3 py-2">{taskRows.length} tarefas</span><span className="rounded-full border border-white/10 bg-black/35 px-3 py-2">{timezone}</span></div>
        </div>
      </section>

      {upcomingSession?.scheduled_at && (
        <section className="mb-8 grid gap-5 rounded-3xl border border-orange-500/25 bg-gradient-to-r from-orange-500/15 to-amber-500/[0.04] p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">Próximo encontro</p><h2 className="mt-2 text-2xl font-black">{formatDate(upcomingSession.scheduled_at)}</h2><p className="mt-1 text-sm text-white/45">{upcomingSession.title || 'Sessão individual'} · {upcomingSession.reschedule_count || 0}/{program?.max_reschedules ?? 2} reagendamentos</p></div>
          <div className="flex flex-wrap gap-2">{upcomingSession.meeting_url && <a href={upcomingSession.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-black">Entrar na sala <ExternalLink className="h-4 w-4" /></a>}{canCancelUpcoming && <form action={cancelMentorshipSession.bind(null, product.id, upcomingSession.id)}><button className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/65 hover:bg-white/5">Cancelar</button></form>}</div>
          {canRescheduleUpcoming && slotRows.length > 0 && <form action={rescheduleMentorshipSession.bind(null, product.id, upcomingSession.id)} className="flex flex-col gap-2 lg:col-span-2 sm:flex-row"><select name="slot_id" required className="h-11 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white"><option value="">Escolha o novo horário</option>{slotRows.map(slot => <option key={slot.id} value={slot.id}>{formatDate(slot.starts_at)}</option>)}</select><button className="h-11 rounded-xl bg-white px-4 text-sm font-black text-black">Reagendar</button></form>}
          {!canCancelUpcoming && <p className="text-xs text-white/35 lg:col-span-2">O prazo de cancelamento e reagendamento desta sessão já encerrou.</p>}
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-3xl border border-white/10 bg-[#111] p-6">
          <h2 className="mb-6 flex items-center gap-2 text-xl font-black text-white">
            <Target className="h-5 w-5 text-[#f97316]" />
            Mapa da jornada
          </h2>
          <div className="space-y-4">
            {sessionRows.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/15 p-8 text-sm text-white/45">Seu mentor ainda está configurando as etapas.</p>
            ) : (
              sessionRows.map((session, index) => (
                <div key={session.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f97316]/10 font-black text-[#f97316]">{index + 1}</div>
                    <div>
                      <h3 className="font-black text-white">{session.title}</h3>
                      {session.description && <p className="mt-1 text-sm text-white/45">{session.description}</p>}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-white/40">
                        <span className="rounded-full bg-white/5 px-3 py-1">{session.status}</span>
                        {session.scheduled_at && <span className="rounded-full bg-white/5 px-3 py-1">{formatDate(session.scheduled_at)}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="space-y-5">
          {questions.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-[#111] p-6">
              <h2 className="flex items-center gap-2 text-lg font-black text-white">
                <FileText className="h-5 w-5 text-[#f97316]" />
                Diagnóstico
              </h2>
              <form action={saveIntakeResponses.bind(null, product.id)} className="mt-4 space-y-3">
                {questions.map((question: string, index: number) => (
                  <label key={index} className="block">
                    <span className="mb-2 block text-xs font-bold uppercase text-white/35">{question}</span>
                    <textarea
                      name={`question_${index}`}
                      defaultValue={answers[String(index)] || ''}
                      required
                      className="min-h-20 w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#f97316]"
                    />
                  </label>
                ))}
                <button className="w-full rounded-xl bg-[#f97316] px-4 py-3 text-sm font-black text-black">
                  {intake?.submitted_at ? 'Atualizar diagnóstico' : 'Enviar diagnóstico'}
                </button>
              </form>
            </div>
          )}

          <div className="rounded-3xl border border-white/10 bg-[#111] p-6">
            <h2 className="flex items-center gap-2 text-lg font-black text-white">
              <CalendarClock className="h-5 w-5 text-[#f97316]" />
              Agendar sessão
            </h2>
            <div className="mt-4 space-y-2">
              {slotRows.length === 0 ? (
                <p className="text-sm text-white/35">Nenhum horário disponível no momento.</p>
              ) : (
                slotRows.map(slot => (
                  <form key={slot.id} action={bookMentorshipSlot.bind(null, product.id, slot.id)} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">{formatDate(slot.starts_at)}</p>
                        <p className="text-xs text-white/35">Duração até {new Date(slot.ends_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone })}</p>
                      </div>
                      <button className="rounded-xl bg-[#f97316] px-3 py-2 text-xs font-black text-black">Reservar</button>
                    </div>
                  </form>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#111] p-6">
            <h2 className="flex items-center gap-2 text-lg font-black text-white">
              <CheckCircle2 className="h-5 w-5 text-[#f97316]" />
              Execução
            </h2>
            <p className="mt-2 text-sm text-white/45">{completedTasks}/{taskRows.length} tarefas concluídas</p>
            <div className="mt-4 space-y-2">
              {taskRows.length === 0 ? (
                <p className="text-sm text-white/35">Nenhuma tarefa atribuída ainda.</p>
              ) : (
                taskRows.map(task => {
                  const completed = Boolean(task.completed_at)
                  const action = toggleMentorshipTask.bind(null, product.id, task.id, !completed)
                  return (
                    <form key={task.id} action={action} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <button className="flex w-full items-start gap-3 text-left">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${completed ? 'border-[#f97316] bg-[#f97316] text-black' : 'border-white/15 text-transparent'}`}>
                          <Check className="h-3 w-3" />
                        </span>
                        <span>
                          <span className="block text-sm font-bold text-white">{task.title}</span>
                          {task.description && <span className="mt-1 block text-xs text-white/40">{task.description}</span>}
                          {task.due_at && <span className="mt-1 block text-[11px] font-bold text-orange-400/75">Prazo: {formatDate(task.due_at)}</span>}
                        </span>
                      </button>
                    </form>
                  )
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#111] p-6"><h2 className="flex items-center gap-2 text-lg font-black"><Clock3 className="h-5 w-5 text-orange-500" />Regras da agenda</h2><p className="mt-3 text-sm leading-6 text-white/45">Agende com pelo menos {program?.booking_min_notice_hours ?? 2} horas de antecedência. Cancelamentos e reagendamentos ficam disponíveis até {program?.cancellation_notice_hours ?? 24} horas antes.</p></div>
        </aside>
      </div>
      </main>
    </div>
  )
}
