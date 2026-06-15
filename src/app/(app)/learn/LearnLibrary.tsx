'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Play,
  Search,
  Sparkles,
  X,
} from 'lucide-react'

type LibraryProduct = {
  id: string
  name: string
  short_description: string | null
  description: string | null
  cover_url: string | null
  logo_url: string | null
  product_type: string
  category: string | null
  grantedAt: string
  lastAccessedAt: string | null
  totalLessons: number
  completedLessons: number
  progress: number
  continueHref: string
}

type Filter = 'all' | 'course' | 'mentoria' | 'file'

function productKind(product: LibraryProduct): Filter {
  if (product.product_type === 'course') return 'course'
  if (product.product_type === 'mentoria') return 'mentoria'
  return 'file'
}

function typeLabel(product: LibraryProduct) {
  if (product.product_type === 'mentoria') return 'Mentoria'
  if (product.product_type === 'course') return product.category || 'Curso'
  return product.category || 'Arquivo digital'
}

export function LearnLibrary({ products, userName }: { products: LibraryProduct[]; userName: string }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const featured = products[0]
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesFilter = filter === 'all' || productKind(product) === filter
    const haystack = `${product.name} ${product.category || ''} ${product.short_description || ''}`.toLocaleLowerCase('pt-BR')
    return matchesFilter && (!normalizedSearch || haystack.includes(normalizedSearch))
  }), [filter, normalizedSearch, products])
  const inProgress = filteredProducts.filter(product => product.progress > 0 && product.progress < 100)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_70%_0%,rgba(249,115,22,0.09),transparent_25%),#070809] pb-16 text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#070809]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1600px] items-center gap-4 px-4 md:px-8">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-white/55 transition hover:border-white/25 hover:text-white md:px-4 md:text-sm">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Sair dos meus acessos</span>
          </Link>

          <Link href="/learn" className="hidden shrink-0 items-center gap-2 lg:flex">
            <img src="/brand/logo-dark.png" alt="Flowyn" className="h-9 w-auto" />
            <span className="text-lg font-black text-orange-500">Play</span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1 md:flex">
            {([
              ['all', 'Todos'],
              ['course', 'Cursos'],
              ['mentoria', 'Mentorias'],
              ['file', 'Arquivos'],
            ] as const).map(([value, label]) => (
              <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-sm font-bold transition ${filter === value ? 'bg-orange-500 text-black' : 'text-white/45 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </nav>

          <label className="ml-auto flex h-11 min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 transition focus-within:border-orange-500/50 md:ml-3 md:w-52">
            <Search className="h-4 w-4 shrink-0 text-white/35" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25" />
            {search && <button onClick={() => setSearch('')} aria-label="Limpar busca"><X className="h-3.5 w-3.5 text-white/35" /></button>}
          </label>

          <div className="hidden shrink-0 items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1.5 pr-4 sm:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-400 text-xs font-black text-black">{userName.charAt(0).toUpperCase()}</span>
            <span className="max-w-32 truncate text-sm font-bold text-white/70">{userName}</span>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto px-4 pb-3 md:hidden">
          {([['all', 'Todos'], ['course', 'Cursos'], ['mentoria', 'Mentorias'], ['file', 'Arquivos']] as const).map(([value, label]) => (
            <button key={value} onClick={() => setFilter(value)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${filter === value ? 'bg-orange-500 text-black' : 'bg-white/[0.05] text-white/50'}`}>{label}</button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 pt-7 md:px-8 md:pt-9">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">Flowyn Play</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">Meus acessos</h1>
          </div>
          <p className="hidden text-sm text-white/30 sm:block">{products.length} {products.length === 1 ? 'acesso disponível' : 'acessos disponíveis'}</p>
        </div>

        {featured ? (
          <section className="group relative min-h-[400px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111] md:min-h-[470px]">
            {featured.cover_url ? (
              <img src={featured.cover_url} alt={featured.name} className="absolute inset-0 h-full w-full object-cover opacity-65 transition duration-700 group-hover:scale-[1.02]" />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_45%,rgba(249,115,22,0.4),transparent_20%),repeating-radial-gradient(ellipse_at_80%_50%,transparent_0,transparent_35px,rgba(249,115,22,0.12)_37px,transparent_39px),linear-gradient(120deg,#090909,#1c0d04)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/5" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20" />
            <div className="relative flex min-h-[400px] max-w-2xl flex-col justify-end p-6 md:min-h-[470px] md:p-12">
              <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-orange-400">
                <Sparkles className="h-3.5 w-3.5" /> Em destaque
              </span>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-400">{typeLabel(featured)}</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">{featured.name}</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/60 md:text-base">{featured.short_description || featured.description || 'Seu acesso está pronto para continuar.'}</p>
              {featured.totalLessons > 0 && (
                <div className="mt-5 max-w-md">
                  <div className="flex justify-between text-xs font-bold text-white/55"><span>{featured.completedLessons} de {featured.totalLessons} aulas concluídas</span><span>{featured.progress}%</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-orange-500" style={{ width: `${featured.progress}%` }} /></div>
                </div>
              )}
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={featured.continueHref} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-black text-black transition hover:bg-orange-400">
                  <Play className="h-4 w-4 fill-current" /> Continuar assistindo
                </Link>
                <Link href={`/learn/${featured.id}`} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/25 px-5 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10">
                  <Info className="h-4 w-4" /> Ver detalhes
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="flex min-h-[420px] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-white/15 bg-white/[0.02] px-6 text-center">
            <Play className="h-12 w-12 text-orange-500/70" />
            <h2 className="mt-5 text-2xl font-black">Nenhum acesso liberado ainda</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/40">Quando você comprar um curso, mentoria ou arquivo, ele aparecerá automaticamente aqui.</p>
          </section>
        )}

        {inProgress.length > 0 && <ProductRail title="Continue estudando" products={inProgress} variant="wide" />}
        {filteredProducts.length > 0 && <ProductRail title={filter === 'all' ? 'Todos os seus acessos' : `Seus ${filter === 'course' ? 'cursos' : filter === 'mentoria' ? 'programas de mentoria' : 'arquivos'}`} products={filteredProducts} />}

        {products.length > 0 && filteredProducts.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">Nenhum acesso corresponde à sua busca.</div>
        )}
      </main>
    </div>
  )
}

function ProductRail({ title, products, variant = 'compact' }: { title: string; products: LibraryProduct[]; variant?: 'wide' | 'compact' }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-black md:text-2xl">{title}</h2>
        <div className="hidden gap-2 sm:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/25"><ChevronLeft className="h-4 w-4" /></span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/50"><ChevronRight className="h-4 w-4" /></span>
        </div>
      </div>
      <div className={`grid gap-4 ${variant === 'wide' ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'}`}>
        {products.map((product, index) => <ProductCard key={product.id} product={product} index={index} variant={variant} />)}
      </div>
    </section>
  )
}

function ProductCard({ product, index, variant }: { product: LibraryProduct; index: number; variant: 'wide' | 'compact' }) {
  const kind = productKind(product)
  return (
    <Link href={product.continueHref} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#101113] transition duration-300 hover:-translate-y-1 hover:border-orange-500/35 hover:shadow-2xl hover:shadow-orange-950/20">
      <div className={`${variant === 'wide' ? 'aspect-[16/9]' : 'aspect-[4/3]'} relative overflow-hidden bg-[#151515]`}>
        {product.cover_url ? (
          <img src={product.cover_url} alt={product.name} className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />
        ) : (
          <div className={`h-full w-full ${index % 3 === 0 ? 'bg-[radial-gradient(circle_at_25%_30%,rgba(249,115,22,0.4),transparent_25%),linear-gradient(135deg,#1d0d04,#070707)]' : index % 3 === 1 ? 'bg-[radial-gradient(circle_at_60%_30%,rgba(59,130,246,0.3),transparent_25%),linear-gradient(135deg,#07131d,#070707)]' : 'bg-[radial-gradient(circle_at_65%_35%,rgba(168,85,247,0.3),transparent_25%),linear-gradient(135deg,#16091d,#070707)]'}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white/70 backdrop-blur">
          {kind === 'mentoria' ? <CalendarDays className="h-3 w-3 text-violet-400" /> : kind === 'file' ? <FileText className="h-3 w-3 text-sky-400" /> : <Play className="h-3 w-3 text-orange-400" />}
          {typeLabel(product)}
        </span>
        <span className="absolute bottom-3 right-3 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-orange-500 text-black opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100"><Play className="ml-0.5 h-4 w-4 fill-current" /></span>
      </div>
      <div className="p-4">
        <h3 className="truncate text-sm font-black text-white">{product.name}</h3>
        <p className="mt-1 line-clamp-1 text-xs text-white/35">{product.short_description || product.description || 'Acesso disponível'}</p>
        {product.totalLessons > 0 ? (
          <div className="mt-4">
            <div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-orange-500" style={{ width: `${product.progress}%` }} /></div>
            <div className="mt-2 flex justify-between text-[10px] font-bold text-white/30"><span>{product.completedLessons} de {product.totalLessons} aulas</span><span>{product.progress}%</span></div>
          </div>
        ) : <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-orange-400/70">Acesso liberado</p>}
      </div>
    </Link>
  )
}
