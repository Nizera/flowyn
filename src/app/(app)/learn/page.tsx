import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { BookOpen, Clapperboard, Play, Route, Sparkles } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { claimPendingStudentAccess } from '@/lib/student-access'

export const dynamic = 'force-dynamic'

export default async function LearnLibraryPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  await claimPendingStudentAccess(user.id, user.email)

  const admin = createAdminClient()
  const { data: accessRows } = await admin
    .from('student_access')
    .select('id, granted_at, product:products(id, name, short_description, description, cover_url, logo_url, product_type, category)')
    .eq('user_id', user.id)
    .order('granted_at', { ascending: false })

  const products = (accessRows || []).map((row: any) => row.product).filter(Boolean)
  const featured = products[0]
  const courses = products.filter((product: any) => product.product_type === 'course')
  const mentorships = products.filter((product: any) => product.product_type === 'mentoria')

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-12">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#111] min-h-[360px]">
        {featured?.cover_url ? (
          <img src={featured.cover_url} alt={featured.name} className="absolute inset-0 h-full w-full object-cover opacity-55" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(0,232,138,0.22),transparent_32%),linear-gradient(135deg,#161616,#050505)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#111] via-[#111]/70 to-transparent" />
        <div className="relative flex min-h-[360px] max-w-2xl flex-col justify-end p-8 md:p-10">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-black/45 px-3 py-1 text-xs font-bold text-[#00e88a]">
            <Sparkles className="h-3.5 w-3.5" />
            Flowyn Play
          </div>
          <h1 className="text-4xl font-black text-white md:text-5xl">
            {featured ? featured.name : 'Sua biblioteca Flowyn'}
          </h1>
          <p className="mt-4 text-sm leading-6 text-white/65">
            {featured?.short_description || featured?.description || 'Cursos e jornadas comprados aparecem aqui, com acesso premium e progresso centralizado.'}
          </p>
          {featured ? (
            <Link href={`/learn/${featured.id}`} className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-[#00e88a] px-5 py-3 text-sm font-black text-black transition hover:bg-[#04f294]">
              <Play className="h-4 w-4" />
              Continuar
            </Link>
          ) : (
            <div className="mt-6 inline-flex w-fit rounded-xl border border-white/10 bg-black/35 px-5 py-3 text-sm font-bold text-white/60">
              Seus acessos comprados aparecerao aqui.
            </div>
          )}
        </div>
      </section>

      {products.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-[#111] p-10 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black text-white">Nenhum acesso liberado ainda</h2>
          <p className="mt-2 text-sm text-white/45">Quando você comprar um curso ou mentoria, ele aparece aqui automaticamente.</p>
        </div>
      ) : (
        <>
          <Shelf title="Continue estudando" products={courses} icon={<Clapperboard className="h-5 w-5" />} />
          <Shelf title="Suas jornadas" products={mentorships} icon={<Route className="h-5 w-5" />} />
        </>
      )}
    </div>
  )
}

function Shelf({ title, products, icon }: { title: string; products: any[]; icon: ReactNode }) {
  if (products.length === 0) return null

  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white">
        <span className="text-[#00e88a]">{icon}</span>
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map(product => (
          <Link key={product.id} href={`/learn/${product.id}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#111] transition hover:-translate-y-1 hover:border-[#00e88a]/35">
            <div className="aspect-video bg-black">
              {product.cover_url ? (
                <img src={product.cover_url} alt={product.name} className="h-full w-full object-cover opacity-80 transition group-hover:scale-105" />
              ) : (
                <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(0,232,138,0.22),transparent_36%),linear-gradient(135deg,#181818,#080808)]" />
              )}
            </div>
            <div className="p-4">
              <p className="text-xs font-bold uppercase text-[#00e88a]">{product.category || 'Flowyn'}</p>
              <h3 className="mt-1 line-clamp-2 text-sm font-black text-white">{product.name}</h3>
              <p className="mt-2 line-clamp-2 text-xs text-white/45">{product.short_description || product.description || 'Acesso liberado'}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
