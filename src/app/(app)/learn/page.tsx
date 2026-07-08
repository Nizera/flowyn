import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { claimPendingStudentAccess } from '@/lib/student-access'
import { LearnLibrary } from './LearnLibrary'

type ProductRow = {
  id: string
  name: string
  short_description: string | null
  description: string | null
  cover_url: string | null
  logo_url: string | null
  product_type: string
  category: string | null
}

type AccessRow = {
  granted_at: string
  last_accessed_at: string | null
  product: ProductRow | ProductRow[] | null
}

type LessonRow = {
  id: string
  product_id: string
}

type ProgressRow = {
  lesson_id: string
  product_id: string
  completed_at: string | null
}

export const dynamic = 'force-dynamic'

export default async function LearnLibraryPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  await claimPendingStudentAccess(user.id, user.email)

  const admin = createAdminClient()
  const [{ data: accessRows }, { data: profile }] = await Promise.all([
    admin
      .from('student_access')
      .select('granted_at, last_accessed_at, product:products(id, name, short_description, description, cover_url, logo_url, product_type, category)')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .order('last_accessed_at', { ascending: false, nullsFirst: false })
      .order('granted_at', { ascending: false }),
    admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ])

  const accesses = ((accessRows ?? []) as unknown as AccessRow[]).flatMap((row) => {
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    return product ? [{ ...product, grantedAt: row.granted_at, lastAccessedAt: row.last_accessed_at }] : []
  })
  const productIds = accesses.map(product => product.id)

  let lessonRows: LessonRow[] = []
  let progressRows: ProgressRow[] = []
  if (productIds.length > 0) {
    const [{ data: lessons }, { data: progress }] = await Promise.all([
      admin.from('course_lessons').select('id, product_id').in('product_id', productIds),
      admin
        .from('lesson_progress')
        .select('lesson_id, product_id, completed_at')
        .eq('user_id', user.id)
        .in('product_id', productIds),
    ])
    lessonRows = (lessons ?? []) as LessonRow[]
    progressRows = (progress ?? []) as ProgressRow[]
  }

  const libraryProducts = accesses.map((product) => {
    const productLessons = lessonRows.filter(lesson => lesson.product_id === product.id)
    const completedLessonIds = new Set(
      progressRows
        .filter(progress => progress.product_id === product.id && progress.completed_at)
        .map(progress => progress.lesson_id),
    )
    const nextLesson = productLessons.find(lesson => !completedLessonIds.has(lesson.id))
    const progress = productLessons.length > 0
      ? Math.round((completedLessonIds.size / productLessons.length) * 100)
      : 0

    return {
      ...product,
      totalLessons: productLessons.length,
      completedLessons: completedLessonIds.size,
      progress,
      continueHref: nextLesson ? `/learn/${product.id}?lesson=${nextLesson.id}` : `/learn/${product.id}`,
    }
  })

  return (
    <LearnLibrary
      products={libraryProducts}
      userName={profile?.full_name || user.email?.split('@')[0] || 'Aluno'}
    />
  )
}
