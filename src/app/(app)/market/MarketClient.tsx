'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { TrendingUp, Handshake, Users, SlidersHorizontal, X, Search, ChevronDown, Star, ExternalLink } from 'lucide-react'

const CATEGORIES: Record<string, string> = {
  all: 'Todas as Categorias',
  saas: 'SaaS / Software',
  cursos: 'Cursos Online',
  saude: 'Saúde & Bem-estar',
  financas: 'Finanças & Investimentos',
  marketing: 'Marketing & Negócios',
  educacao: 'Educação',
  beleza: 'Beleza & Moda',
  tecnologia: 'Tecnologia',
  entretenimento: 'Entretenimento',
  outros: 'Outros',
}

const CATEGORY_COLORS: Record<string, string> = {
  saas: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  cursos: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  saude: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  financas: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  marketing: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  educacao: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  beleza: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  tecnologia: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  entretenimento: 'bg-red-500/20 text-red-300 border-red-500/30',
  outros: 'bg-white/10 text-white/50 border-white/20',
}

type Product = {
  id: string
  name: string
  logo_url: string | null
  cover_url: string | null
  site_url: string | null
  commission_rate: number
  category: string | null
  owner: { full_name: string | null } | null
  plans: { price: number }[]
}

type Props = {
  products: Product[]
  affiliatedProductIds: string[]
  countMap: Record<string, number>
  isAffiliate: boolean
  promoteProduct: (formData: FormData) => Promise<void>
}

type SortKey = 'newest' | 'commission_desc' | 'commission_asc' | 'price_asc' | 'price_desc' | 'affiliates_desc'

export default function MarketClient({ products, affiliatedProductIds, countMap, isAffiliate, promoteProduct }: Props) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [minCommission, setMinCommission] = useState(0)
  const [maxPrice, setMaxPrice] = useState(9999)
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    let list = [...products]

    // search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.owner?.full_name?.toLowerCase().includes(q))
    }

    // category
    if (category !== 'all') {
      list = list.filter(p => (p.category || 'outros') === category)
    }

    // commission
    if (minCommission > 0) {
      list = list.filter(p => p.commission_rate >= minCommission)
    }

    // max price
    list = list.filter(p => {
      if (!p.plans?.length) return true
      const min = Math.min(...p.plans.map(pl => Number(pl.price)))
      return min <= maxPrice
    })

    // sort
    switch (sort) {
      case 'commission_desc': list.sort((a, b) => b.commission_rate - a.commission_rate); break
      case 'commission_asc':  list.sort((a, b) => a.commission_rate - b.commission_rate); break
      case 'price_asc':
        list.sort((a, b) => {
          const pa = a.plans?.length ? Math.min(...a.plans.map(p => Number(p.price))) : 0
          const pb = b.plans?.length ? Math.min(...b.plans.map(p => Number(p.price))) : 0
          return pa - pb
        }); break
      case 'price_desc':
        list.sort((a, b) => {
          const pa = a.plans?.length ? Math.min(...a.plans.map(p => Number(p.price))) : 0
          const pb = b.plans?.length ? Math.min(...b.plans.map(p => Number(p.price))) : 0
          return pb - pa
        }); break
      case 'affiliates_desc':
        list.sort((a, b) => (countMap[b.id] || 0) - (countMap[a.id] || 0)); break
      default: break // newest = original order
    }

    return list
  }, [products, search, category, sort, minCommission, maxPrice, countMap])

  const hasActiveFilters = search || category !== 'all' || sort !== 'newest' || minCommission > 0 || maxPrice < 9999

  function clearFilters() {
    setSearch('')
    setCategory('all')
    setSort('newest')
    setMinCommission(0)
    setMaxPrice(9999)
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Buscar produto ou produtor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#111111] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] outline-none transition-all"
          />
        </div>

        {/* Sort select */}
        <div className="relative">
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="appearance-none bg-[#111111] border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] outline-none cursor-pointer transition-all"
          >
            <option value="newest">Mais recentes</option>
            <option value="commission_desc">Maior comissão</option>
            <option value="commission_asc">Menor comissão</option>
            <option value="price_asc">Menor preço</option>
            <option value="price_desc">Maior preço</option>
            <option value="affiliates_desc">Mais afiliados</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
        </div>

        {/* Filtros button */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
            hasActiveFilters
              ? 'bg-[#00e88a]/10 border-[#00e88a]/40 text-[#00e88a]'
              : 'bg-[#111111] border-white/10 text-white/70 hover:text-white hover:bg-white/5'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtros
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-[#00e88a] rounded-full" />
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Categoria</label>
            <div className="relative">
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full appearance-none bg-[#0a0a0a] border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] transition-all cursor-pointer"
              >
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            </div>
          </div>

          {/* Min Commission */}
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
              Comissão mínima: <span className="text-[#00e88a]">{minCommission}%</span>
            </label>
            <input
              type="range" min={0} max={90} step={5}
              value={minCommission}
              onChange={e => setMinCommission(Number(e.target.value))}
              className="w-full accent-[#00e88a] cursor-pointer"
            />
            <div className="flex justify-between text-xs text-white/30 mt-1">
              <span>0%</span><span>90%</span>
            </div>
          </div>

          {/* Max Price */}
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
              Preço máximo: <span className="text-[#00e88a]">{maxPrice >= 9999 ? 'Qualquer' : `R$ ${maxPrice}`}</span>
            </label>
            <input
              type="range" min={0} max={9999} step={50}
              value={maxPrice}
              onChange={e => setMaxPrice(Number(e.target.value))}
              className="w-full accent-[#00e88a] cursor-pointer"
            />
            <div className="flex justify-between text-xs text-white/30 mt-1">
              <span>R$ 0</span><span>Qualquer</span>
            </div>
          </div>

          {/* Category pills quick filter */}
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Atalhos</label>
            <div className="flex flex-wrap gap-1.5">
              {['saas', 'cursos', 'saude', 'financas', 'marketing'].map(k => (
                <button
                  key={k}
                  onClick={() => setCategory(category === k ? 'all' : k)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                    category === k
                      ? CATEGORY_COLORS[k]
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {CATEGORIES[k].split(' /')[0].split(' &')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-white/40 mb-5">
        Exibindo <span className="text-white font-semibold">{filtered.length}</span> de {products.length} produtos
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <Search className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <p className="text-white/40 text-lg font-medium">Nenhum produto encontrado</p>
          <button onClick={clearFilters} className="mt-4 text-[#00e88a] text-sm hover:underline">Limpar filtros</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((p, idx) => {
            const isAffiliated = affiliatedProductIds.includes(p.id)
            const affiliateCount = countMap[p.id] || 0
            const plans = p.plans || []
            const minPrice = plans.length > 0 ? Math.min(...plans.map(pl => Number(pl.price))) : null
            const cat = p.category || 'outros'
            const rank = idx + 1

            return (
              <div
                key={p.id}
                className="group bg-[#111111] border border-white/10 rounded-2xl overflow-hidden hover:border-[#00e88a]/30 hover:-translate-y-1 transition-all duration-300 shadow-xl hover:shadow-[0_8px_30px_rgba(0,232,138,0.08)] flex flex-col"
              >
                {/* Cover Image */}
                <div className="relative h-44 bg-[#0a0a0a] flex-shrink-0 overflow-hidden">
                  {p.cover_url ? (
                    <img
                      src={p.cover_url}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : p.logo_url ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0f0f0f] to-[#1a1a1a]">
                      <img src={p.logo_url} alt={p.name} className="w-20 h-20 object-contain opacity-80" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0f1f17] to-[#0a0a0a]">
                      <span className="text-5xl font-black text-[#00e88a]/20 select-none">
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Rank badge */}
                  {rank <= 3 && (
                    <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black ${
                      rank === 1 ? 'bg-yellow-400 text-black' :
                      rank === 2 ? 'bg-gray-300 text-black' :
                      'bg-orange-400 text-black'
                    }`}>
                      <Star className="w-2.5 h-2.5 fill-current" />
                      {rank}º
                    </div>
                  )}

                  {/* Category pill */}
                  <div className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${CATEGORY_COLORS[cat] || CATEGORY_COLORS['outros']}`}>
                    {CATEGORIES[cat]?.split(' /')[0].split(' &')[0] || 'Outros'}
                  </div>

                  {/* Commission badge overlay */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded-lg">
                    <TrendingUp className="w-3 h-3 text-[#00e88a]" />
                    <span className="text-xs font-black text-[#00e88a]">{p.commission_rate}% comissão</span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    {p.logo_url && (
                      <img
                        src={p.logo_url}
                        alt={p.name}
                        className="w-9 h-9 rounded-lg object-cover border border-white/10 flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <h3 className="font-bold text-white text-sm leading-tight truncate group-hover:text-[#00e88a] transition-colors">
                        {p.name}
                      </h3>
                      <p className="text-xs text-white/40 mt-0.5 truncate">
                        por {p.owner?.full_name || 'Anônimo'}
                      </p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-1 text-xs text-white/50">
                      <Users className="w-3 h-3" />
                      <span>{affiliateCount} afiliados</span>
                    </div>
                    {minPrice !== null && (
                      <div className="text-xs font-bold text-white">
                        R$ {minPrice.toFixed(2).replace('.', ',')}
                        <span className="text-white/30 font-normal">/mês</span>
                      </div>
                    )}
                    {p.site_url && (
                      <a
                        href={p.site_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-white/30 hover:text-[#00e88a] transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="mt-auto">
                    {isAffiliated ? (
                      <Link
                        href="/dashboard/affiliations"
                        className="w-full inline-flex justify-center items-center gap-2 bg-white/5 border border-white/10 text-white/70 font-semibold py-2.5 px-4 rounded-xl text-sm hover:bg-white/10 transition-colors"
                      >
                        ✅ Já sou afiliado
                      </Link>
                    ) : (
                      <form action={promoteProduct}>
                        <input type="hidden" name="product_id" value={p.id} />
                        <button
                          type="submit"
                          disabled={!isAffiliate}
                          className="w-full inline-flex justify-center items-center gap-2 bg-[#00e88a] text-black font-bold py-2.5 px-4 rounded-xl hover:bg-[#00e88a]/90 transition-all shadow-[0_0_12px_rgba(0,232,138,0.15)] hover:shadow-[0_0_20px_rgba(0,232,138,0.3)] disabled:opacity-40 disabled:cursor-not-allowed text-sm hover:-translate-y-0.5 active:translate-y-0"
                        >
                          <Handshake className="w-4 h-4" />
                          {isAffiliate ? 'Afiliar-se' : 'Apenas Afiliados'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
