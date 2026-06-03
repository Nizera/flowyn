import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clapperboard,
  GripVertical,
  Layers,
  Palette,
  Plus,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { CourseLessonForm } from './CourseLessonForm'
import { createAdminClient } from '@/utils/supabase/admin'
import { getResendClient } from '@/lib/resend'
import { learningNotificationEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

function parseJsonStringArray(value: string) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : []
  } catch {
    return []
  }
}

export default async function CourseContentPage(props: { params: Promise<{ id: string }> }) {
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

  const { data: modules } = await supabase
    .from('course_modules')
    .select('*, lessons:course_lessons(*)')
    .eq('product_id', id)
    .order('sort_order', { ascending: true })

  async function createModule(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const title = String(formData.get('title') || '').trim()
    if (!title) return

    const { count } = await supabase
      .from('course_modules')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id)

    await supabase.from('course_modules').insert({
      product_id: id,
      title,
      description: String(formData.get('description') || '').trim() || null,
      sort_order: count || 0,
    })

    revalidatePath(`/dashboard/products/${id}/content`)
  }

  async function createLesson(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const moduleId = String(formData.get('module_id') || '')
    const title = String(formData.get('title') || '').trim()
    if (!moduleId || !title) return

    const { count } = await supabase
      .from('course_lessons')
      .select('id', { count: 'exact', head: true })
      .eq('module_id', moduleId)

    const { data: lesson } = await supabase.from('course_lessons').insert({
      product_id: id,
      module_id: moduleId,
      title,
      description: String(formData.get('description') || '').trim() || null,
      video_url: String(formData.get('video_url') || '').trim() || null,
      video_file_path: String(formData.get('video_file_path') || '').trim() || null,
      content_url: String(formData.get('content_url') || '').trim() || null,
      material_file_paths: parseJsonStringArray(String(formData.get('material_file_paths') || '[]')),
      duration_minutes: Number(formData.get('duration_minutes') || 0) || null,
      is_free_preview: formData.get('is_free_preview') === 'on',
      sort_order: count || 0,
    }).select('id, title').single()

    const resendClient = getResendClient()
    if (resendClient && lesson) {
      const admin = createAdminClient()
      const { data: product } = await admin
        .from('products')
        .select('name')
        .eq('id', id)
        .single()
      const { data: accessRows } = await admin
        .from('student_access')
        .select('user_id, access_email')
        .eq('product_id', id)

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
      for (const access of accessRows || []) {
        if (!access.access_email) continue
        await resendClient.emails.send({
          from: 'Flowyn <noreply@flowyn.com.br>',
          to: access.access_email,
          subject: `Nova aula em "${product?.name || 'seu curso'}"`,
          html: learningNotificationEmail({
            title: 'Nova aula disponível',
            message: `A aula "${lesson.title}" foi adicionada ao seu curso.`,
            actionLabel: 'Assistir agora',
            actionUrl: `${appUrl}/learn/${id}`,
          }),
        })
        await admin.from('notification_events').insert({
          user_id: access.user_id,
          product_id: id,
          recipient_email: access.access_email,
          event_type: 'lesson_created',
          status: 'sent',
          sent_at: new Date().toISOString(),
          metadata: { lesson_id: lesson.id },
        })
      }
    }

    revalidatePath(`/dashboard/products/${id}/content`)
  }

  async function deleteModule(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const moduleId = String(formData.get('module_id') || '')
    if (!moduleId) return
    await supabase.from('course_modules').delete().eq('id', moduleId).eq('product_id', id)
    revalidatePath(`/dashboard/products/${id}/content`)
  }

  async function deleteLesson(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const lessonId = String(formData.get('lesson_id') || '')
    if (!lessonId) return
    await supabase.from('course_lessons').delete().eq('id', lessonId).eq('product_id', id)
    revalidatePath(`/dashboard/products/${id}/content`)
  }

  const isCourse = product.product_type === 'course'
  const moduleRows = (modules || []) as any[]
  const lessonCount = moduleRows.reduce((sum, module) => sum + (module.lessons?.length || 0), 0)

  return (
    <div className="w-full pb-12">
      <main className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center gap-4">
          <Link href={`/dashboard/products/${id}`} className="rounded-xl border border-white/10 bg-[#111] p-2.5 transition hover:bg-white/5">
            <ArrowLeft className="h-5 w-5 text-white/70" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">Conteúdo: {product.name}</h1>
            <p className="mt-1 text-sm text-white/50">Monte uma experiência Flowyn Play com módulos, aulas e materiais.</p>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#111] p-2">
          <Link href={`/dashboard/products/${id}`} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white">
            Detalhes
          </Link>
          <Link href={`/dashboard/products/${id}/plans`} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white">
            Planos
          </Link>
          <Link href={`/dashboard/products/${id}/content`} className="rounded-xl border border-white/5 bg-white/10 px-5 py-2.5 text-sm font-bold text-white">
            Conteúdo
          </Link>
          <Link href={`/dashboard/products/${id}/journey`} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white">
            Mentoria
          </Link>
          <Link href={`/dashboard/products/${id}/checkout-editor`} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white">
            <Palette className="mr-2 inline h-4 w-4" /> Checkout
          </Link>
        </div>

        {!isCourse ? (
          <div className="rounded-3xl border border-amber-500/25 bg-amber-500/10 p-8">
            <h2 className="text-xl font-black text-white">Este produto não está marcado como curso</h2>
            <p className="mt-2 text-sm text-amber-100/75">
              Altere o tipo para Curso Online nos detalhes do produto para usar módulos, aulas e a área Flowyn Play.
            </p>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <section className="lg:col-span-2 space-y-4">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#111]">
                <div className="relative min-h-[240px] bg-black">
                  {product.cover_url ? (
                    <img src={product.cover_url} alt={product.name} className="absolute inset-0 h-full w-full object-cover opacity-60" />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,232,138,0.22),transparent_32%),linear-gradient(135deg,#111,#050505)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/35 to-transparent" />
                  <div className="relative flex min-h-[240px] flex-col justify-end p-8">
                    <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs font-bold text-[#00e88a]">
                      <Clapperboard className="h-3.5 w-3.5" />
                      Flowyn Play
                    </div>
                    <h2 className="max-w-2xl text-3xl font-black text-white">{product.name}</h2>
                    <p className="mt-2 max-w-xl text-sm text-white/65">{product.short_description || product.description || 'Curso pronto para receber uma experiência premium.'}</p>
                  </div>
                </div>
              </div>

              {moduleRows.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/15 bg-[#111] p-10 text-center">
                  <BookOpen className="mx-auto h-12 w-12 text-white/20" />
                  <h3 className="mt-4 text-lg font-black text-white">Nenhum módulo ainda</h3>
                  <p className="mt-1 text-sm text-white/45">Crie o primeiro módulo para começar a montar a trilha do aluno.</p>
                </div>
              ) : (
                moduleRows.map((module, moduleIndex) => {
                  const lessons = [...(module.lessons || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
                  return (
                    <div key={module.id} className="rounded-3xl border border-white/10 bg-[#111] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#00e88a]/10 text-[#00e88a]">
                            {moduleIndex + 1}
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-white">{module.title}</h3>
                            {module.description && <p className="mt-1 text-sm text-white/45">{module.description}</p>}
                          </div>
                        </div>
                        <form action={deleteModule}>
                          <input type="hidden" name="module_id" value={module.id} />
                          <button className="rounded-xl p-2 text-white/30 transition hover:bg-red-500/10 hover:text-red-300">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </div>

                      <div className="mt-5 space-y-2">
                        {lessons.map((lesson) => (
                          <div key={lesson.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <GripVertical className="h-4 w-4 shrink-0 text-white/20" />
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/45">
                                <Clapperboard className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white">{lesson.title}</p>
                                <p className="truncate text-xs text-white/35">
                                  {lesson.duration_minutes ? `${lesson.duration_minutes} min` : 'Sem duração'} {lesson.is_free_preview ? '· preview grátis' : ''}
                                </p>
                              </div>
                            </div>
                            <form action={deleteLesson}>
                              <input type="hidden" name="lesson_id" value={lesson.id} />
                              <button className="rounded-xl p-2 text-white/30 transition hover:bg-red-500/10 hover:text-red-300">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>

                      <CourseLessonForm moduleId={module.id} userId={user.id} createLesson={createLesson} />
                    </div>
                  )
                })
              )}
            </section>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-white/10 bg-[#111] p-6">
                <h2 className="flex items-center gap-2 text-lg font-black text-white">
                  <Layers className="h-5 w-5 text-[#00e88a]" />
                  Nova trilha
                </h2>
                <form action={createModule} className="mt-5 space-y-3">
                  <Input name="title" placeholder="Nome do módulo" required />
                  <textarea name="description" placeholder="Descrição curta" className="min-h-24 w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#00e88a]" />
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00e88a] px-4 py-3 text-sm font-black text-black transition hover:bg-[#04f294]">
                    <Plus className="h-4 w-4" />
                    Criar módulo
                  </button>
                </form>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#111] p-6">
                <h2 className="text-lg font-black text-white">Resumo</h2>
                <div className="mt-5 space-y-3">
                  <Metric label="Módulos" value={moduleRows.length} />
                  <Metric label="Aulas" value={lessonCount} />
                  <Metric label="Entrega" value="Flowyn Play" />
                </div>
                <div className="mt-5 rounded-2xl border border-[#00e88a]/20 bg-[#00e88a]/10 p-4 text-sm text-[#c7ffe3]">
                  <CheckCircle2 className="mb-2 h-5 w-5 text-[#00e88a]" />
                  Compradores com acesso liberado verão este conteúdo em uma experiência de aluno estilo streaming.
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
  required = false,
}: {
  name: string
  placeholder: string
  type?: string
  required?: boolean
}) {
  return (
    <input
      name={name}
      type={type}
      required={required}
      className="w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#00e88a]"
      placeholder={placeholder}
    />
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <span className="text-sm text-white/45">{label}</span>
      <span className="font-black text-white">{value}</span>
    </div>
  )
}
