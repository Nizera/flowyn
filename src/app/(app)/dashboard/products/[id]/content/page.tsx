import type { ReactNode } from 'react'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Building2, CheckCircle2, Clapperboard, ChevronLeft, ChevronRight, CreditCard, Palette, ShoppingBag, Trash2, Users } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getResendClient } from '@/lib/resend'
import { learningNotificationEmail } from '@/lib/email-templates'
import { getAppUrl } from '@/lib/app-url'
import { CourseLessonForm } from './CourseLessonForm'
import { CourseModuleForm } from './CourseModuleForm'
import { DigitalDeliveryForm } from './DigitalDeliveryForm'
import type { CourseContentFormState } from './form-state'

type CourseLessonRow = {
  id: string
  title: string
  duration_minutes: number | null
  is_free_preview: boolean | null
  sort_order: number | null
}

type CourseModuleRow = {
  id: string
  title: string
  description: string | null
  lessons?: CourseLessonRow[]
}

export const dynamic = 'force-dynamic'

function parseJsonStringArray(value: string) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : []
  } catch {
    return []
  }
}

export default async function CourseContentPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ modulo?: string }> }) {
  const { id } = await props.params
  const { modulo: moduloParam } = await props.searchParams
  const currentModuleIndex = moduloParam ? Math.max(0, parseInt(moduloParam, 10)) : 0
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: product } = await supabase
    .from('products')
    .select('id, owner_id, name, product_type, cover_url, short_description, description, delivery_type, delivery_url, deliverable_file_paths')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (!product) redirect('/dashboard/products')

  const admin = createAdminClient()
  const { data: modules } = await admin
    .from('course_modules')
    .select('*, lessons:course_lessons(*)')
    .eq('product_id', id)
    .order('sort_order', { ascending: true })

  async function createModule(_state: CourseContentFormState, formData: FormData): Promise<CourseContentFormState> {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, message: 'Sua sessao expirou. Entre novamente para continuar.' }

    const title = String(formData.get('title') || '').trim()
    if (!title) return { ok: false, message: 'Informe o nome do modulo antes de salvar.' }
    if (title.length < 3) return { ok: false, message: 'O nome do modulo precisa ter pelo menos 3 caracteres.' }

    const { count } = await supabase
      .from('course_modules')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id)

    const { error } = await supabase.from('course_modules').insert({
      product_id: id,
      title,
      description: String(formData.get('description') || '').trim() || null,
      sort_order: count || 0,
    })

    if (error) return { ok: false, message: 'Nao foi possivel criar o modulo. Tente novamente.' }
    revalidatePath(`/dashboard/products/${id}/content`)
    return { ok: true, message: `Modulo "${title}" criado com sucesso.` }
  }

  async function createLesson(_state: CourseContentFormState, formData: FormData): Promise<CourseContentFormState> {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, message: 'Sua sessao expirou. Entre novamente para continuar.' }

    const moduleId = String(formData.get('module_id') || '')
    const title = String(formData.get('title') || '').trim()
    if (!moduleId) return { ok: false, message: 'Modulo nao encontrado. Recarregue a pagina e tente novamente.' }
    if (!title) return { ok: false, message: 'Informe o titulo da aula antes de salvar.' }
    if (title.length < 3) return { ok: false, message: 'O titulo da aula precisa ter pelo menos 3 caracteres.' }

    const { count } = await supabase
      .from('course_lessons')
      .select('id', { count: 'exact', head: true })
      .eq('module_id', moduleId)

    const { data: lesson, error } = await supabase.from('course_lessons').insert({
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

    if (error || !lesson) return { ok: false, message: 'Nao foi possivel criar a aula. Tente novamente.' }

    const resendClient = getResendClient()
    if (resendClient) {
      const admin = createAdminClient()
      const { data: product } = await admin.from('products').select('name').eq('id', id).single()
      const { data: accessRows } = await admin.from('student_access').select('user_id, access_email').eq('product_id', id)
      const appUrl = getAppUrl()

      for (const access of accessRows || []) {
        if (!access.access_email) continue
        await resendClient.emails.send({
          from: 'Flowyn <noreply@flowyn.com.br>',
          to: access.access_email,
          subject: `Nova aula em "${product?.name || 'seu curso'}"`,
          html: learningNotificationEmail({
            title: 'Nova aula disponivel',
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
    return { ok: true, message: `Aula "${title}" criada com sucesso.` }
  }

  async function updateDigitalDelivery(_state: CourseContentFormState, formData: FormData): Promise<CourseContentFormState> {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, message: 'Sua sessao expirou. Entre novamente para continuar.' }

    const deliveryType = String(formData.get('delivery_type') || 'external')
    const deliveryUrl = String(formData.get('delivery_url') || '').trim()
    const filePaths = parseJsonStringArray(String(formData.get('deliverable_file_paths') || '[]'))

    if (deliveryType === 'external' && !deliveryUrl) return { ok: false, message: 'Informe o link de acesso para usar entrega externa.' }
    if (deliveryType === 'platform' && filePaths.length === 0 && !deliveryUrl) return { ok: false, message: 'Anexe pelo menos um arquivo ou informe um link de acesso.' }

    const { error } = await supabase
      .from('products')
      .update({
        delivery_type: deliveryType,
        delivery_url: deliveryUrl || null,
        deliverable_file_paths: filePaths,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('owner_id', user.id)

    if (error) return { ok: false, message: 'Nao foi possivel salvar a entrega. Tente novamente.' }
    revalidatePath(`/dashboard/products/${id}/content`)
    revalidatePath(`/dashboard/products/${id}`)
    return { ok: true, message: 'Entrega digital salva com sucesso.' }
  }

  async function deleteModule(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')
    const moduleId = String(formData.get('module_id') || '')
    if (!moduleId) return
    await supabase.from('course_modules').delete().eq('id', moduleId).eq('product_id', id)
    revalidatePath(`/dashboard/products/${id}/content`)
  }

  async function deleteLesson(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')
    const lessonId = String(formData.get('lesson_id') || '')
    if (!lessonId) return
    await supabase.from('course_lessons').delete().eq('id', lessonId).eq('product_id', id)
    revalidatePath(`/dashboard/products/${id}/content`)
  }

  const isCourse = product.product_type === 'course'
  const isMentorship = product.product_type === 'mentoria'
  const moduleRows = (modules ?? []) as CourseModuleRow[]
  const lessonCount = moduleRows.reduce((sum, module) => sum + (module.lessons?.length || 0), 0)
  const totalModules = moduleRows.length
  const currentModule = totalModules > 0 && currentModuleIndex >= 0 && currentModuleIndex < totalModules
    ? moduleRows[currentModuleIndex]
    : null

  return (
    <section className="overflow-hidden rounded-[10px] bg-white px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href={`/dashboard/products/${id}`} className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Conteudo</h2>
            <p className="mt-2 text-sm text-slate-400">Configure a entrega de {product.name}.</p>
          </div>
        </div>
      </div>

      <ProductTabs productId={id} active="content" />

      {isMentorship ? (
        <div className="mt-10 border-y border-slate-200 py-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-950">Mentoria</h3>
            <p className="mt-1 text-sm text-slate-400">Conteudo fica na jornada.</p>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              Para mentorias, use a aba Mentoria para configurar diagnostico, sessoes, tarefas e acompanhamento dos alunos.
            </p>
            <Link href={`/dashboard/products/${id}/journey`} className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600">
              Abrir mentoria
            </Link>
          </div>
        </div>
      ) : !isCourse ? (
        <div className="mt-10">
          <DigitalDeliveryForm userId={user.id} product={product} updateDigitalDelivery={updateDigitalDelivery} />
        </div>
      ) : (
        <div className="mt-10 max-w-6xl space-y-0">
          {/* Resumo */}
          <div className="border-b border-slate-200 py-6">
            <h3 className="text-sm font-semibold text-slate-950">Resumo</h3>
            <p className="mt-1 text-sm text-slate-400">Estrutura do curso.</p>
            <div className="mt-4 grid gap-6 md:grid-cols-3">
              <Metric label="Modulos" value={totalModules} />
              <Metric label="Aulas" value={lessonCount} />
              <Metric label="Entrega" value="Flowyn Play" />
            </div>
          </div>

          {/* Novo modulo */}
          <div className="border-b border-slate-200 py-6">
            <h3 className="text-sm font-semibold text-slate-950">Novo modulo</h3>
            <p className="mt-1 text-sm text-slate-400">Organize a trilha em etapas.</p>
            <div className="mt-4">
              <CourseModuleForm createModule={createModule} />
            </div>
          </div>

          {/* Modulos com paginacao */}
          <div className="border-b border-slate-200 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Modulos</h3>
                <p className="mt-1 text-sm text-slate-400">Aulas e materiais do curso.</p>
              </div>
              {totalModules > 1 && (
                <div className="flex items-center gap-2">
                  <PaginationButton
                    href={`/dashboard/products/${id}/content?modulo=${currentModuleIndex - 1}`}
                    disabled={currentModuleIndex <= 0}
                    icon={<ChevronLeft className="h-4 w-4" />}
                    label="Anterior"
                  />
                  <span className="text-sm font-semibold text-slate-600">
                    {currentModuleIndex + 1} / {totalModules}
                  </span>
                  <PaginationButton
                    href={`/dashboard/products/${id}/content?modulo=${currentModuleIndex + 1}`}
                    disabled={currentModuleIndex >= totalModules - 1}
                    icon={<ChevronRight className="h-4 w-4" />}
                    label="Proximo"
                  />
                </div>
              )}
            </div>

            <div className="mt-4">
              {totalModules === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-6 py-12 text-center">
                  <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
                  <h3 className="mt-4 font-semibold text-slate-950">Nenhum modulo ainda</h3>
                  <p className="mt-1 text-sm text-slate-400">Crie o primeiro modulo para comecar a montar a trilha do aluno.</p>
                </div>
              ) : currentModule ? (
                (() => {
                  const lessons = [...(currentModule.lessons || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
                  const moduleIndex = currentModuleIndex
                  return (
                    <div className="rounded-lg border border-slate-200">
                      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 font-semibold text-orange-600">
                            {moduleIndex + 1}
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-950">{currentModule.title}</h3>
                            {currentModule.description && <p className="mt-1 text-sm text-slate-400">{currentModule.description}</p>}
                          </div>
                        </div>
                        <form action={deleteModule}>
                          <input type="hidden" name="module_id" value={currentModule.id} />
                          <button className="rounded-xl p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-600" aria-label="Excluir modulo">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </div>

                      <div className="flex flex-wrap gap-2 p-5">
                        {lessons.length === 0 ? (
                          <p className="w-full text-sm text-slate-400">Nenhuma aula neste modulo ainda.</p>
                        ) : lessons.map((lesson) => (
                          <div key={lesson.id} className="flex items-center gap-2 rounded-xl bg-slate-50 pl-3 pr-1.5 py-1.5 ring-1 ring-slate-200/50">
                            <Clapperboard className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="max-w-36 truncate text-sm font-semibold text-slate-950">{lesson.title}</span>
                            {lesson.duration_minutes && <span className="text-xs text-slate-400">{lesson.duration_minutes}min</span>}
                            {lesson.is_free_preview && <span className="text-[10px] font-bold uppercase text-emerald-600">Preview</span>}
                            <form action={deleteLesson}>
                              <input type="hidden" name="lesson_id" value={lesson.id} />
                              <button className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600" aria-label="Excluir aula">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>

                      <div className="p-5 pt-0">
                        <CourseLessonForm moduleId={currentModule.id} userId={user.id} createLesson={createLesson} />
                      </div>
                    </div>
                  )
                })()
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700 ring-1 ring-emerald-100">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            Compradores com acesso liberado verao este conteudo em Meus Acessos.
          </div>
        </div>
      )}
    </section>
  )
}

function PaginationButton({ href, disabled, icon, label }: { href: string; disabled: boolean; icon: ReactNode; label: string }) {
  if (disabled) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-300">
        {icon}
      </span>
    )
  }
  return (
    <Link href={href} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-orange-200 hover:text-orange-600" aria-label={label}>
      {icon}
    </Link>
  )
}

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

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}
