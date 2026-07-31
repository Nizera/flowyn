'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Target, Star, Award, Medal, Trophy, Crown, Gem, TrendingUp, ChevronRight } from 'lucide-react'

interface BadgeReward {
  badge_type: string
  label: string
  description: string
  icon_name: string
  min_sales: number
  physical_reward_name: string | null
  functional_reward: string
  achieved: boolean
  achieved_at: string | null
  is_next: boolean
}

interface BadgeCardProps {
  totalSales?: number
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Target,
  Star,
  Award,
  Medal,
  Trophy,
  Crown,
  Gem,
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`
  return `R$ ${value.toFixed(0)}`
}

export function BadgeCard({ totalSales: initialSales }: BadgeCardProps) {
  const [data, setData] = useState<{
    total_sales: number
    current_badge: BadgeReward | null
    next_badge: BadgeReward | null
    badges: BadgeReward[]
  } | null>(null)
  const [loading, setLoading] = useState(!initialSales)

  useEffect(() => {
    if (initialSales) {
      // Se tiver totalSales, buscar dados completos
      fetch('/api/goals')
        .then(res => res.json())
        .then(setData)
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      fetch('/api/goals')
        .then(res => res.json())
        .then(setData)
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [initialSales])

  if (loading || !data) {
    return (
      <div className="bg-card rounded-2xl p-5 border border-border shadow-sm h-full flex items-center justify-center min-h-[200px]">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    )
  }

  const totalSales = data.total_sales
  const currentBadge = data.current_badge
  const nextBadge = data.next_badge

  // Calcular progresso para próximo badge
  const progressPct = nextBadge
    ? Math.min(((totalSales - (currentBadge?.min_sales || 0)) / (nextBadge.min_sales - (currentBadge?.min_sales || 0))) * 100, 100)
    : 100

  const BadgeIcon = currentBadge
    ? ICON_MAP[currentBadge.icon_name] || Target
    : Target

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm h-full flex flex-col justify-between relative overflow-hidden">
      <div className="flex items-center justify-between mb-3 relative z-10">
        <span className="text-xs font-bold text-muted uppercase tracking-wider">Meta de Vendas</span>
        {currentBadge && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            <TrendingUp className="h-3 w-3" />
            {currentBadge.label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4 my-auto relative z-10">
        {/* Left: Donut chart */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-24 h-24 shrink-0" role="img" aria-label={`Progresso: ${progressPct.toFixed(0)}%`}>
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="none" r="40" stroke="currentColor" className="text-surface border-border" strokeWidth="9" />
              <circle
                className="transition-all duration-700 ease-out text-primary"
                cx="50" cy="50" fill="none" r="40"
                stroke="currentColor"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * progressPct) / 100}
                strokeLinecap="round"
                strokeWidth="9"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-black text-foreground leading-none">{progressPct.toFixed(0)}%</span>
              <span className="text-[10px] font-medium text-muted mt-0.5">da meta</span>
            </div>
          </div>
        </div>

        {/* Right: Badge info */}
        <div className="sm:col-span-7 flex flex-col items-center sm:items-start text-center sm:text-left min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <BadgeIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">
                {currentBadge?.label || 'Iniciante'}
              </p>
              <p className="text-[11px] text-muted">Excelente progresso!</p>
            </div>
          </div>

          <div className="mt-2 w-full pt-2 border-t border-border/50">
            <p className="text-xs font-bold text-foreground">
              {formatCompact(totalSales)}
              {nextBadge && (
                <span className="text-muted font-normal"> / {formatCompact(nextBadge.min_sales)}</span>
              )}
            </p>
            {nextBadge && (
              <p className="text-[11px] text-primary font-semibold mt-0.5 truncate">
                Próximo nível: {nextBadge.label} ({formatCompact(nextBadge.min_sales)})
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Link para página completa */}
      <Link
        href="/dashboard/goals"
        className="mt-4 flex items-center justify-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors relative z-10"
      >
        Ver todas conquistas
        <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
