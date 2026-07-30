'use client'

import { Target, Star, Award, Medal, Trophy, Crown, Gem, TrendingUp } from 'lucide-react'

interface SalesGoalCardProps {
  totalSales: number
}

const STEP = 10_000

const BADGES = [
  { min: 0, label: 'Iniciante', icon: Target },
  { min: 10_000, label: 'Vendedor', icon: Star },
  { min: 50_000, label: 'Top Vendedor', icon: Award },
  { min: 100_000, label: 'Expert', icon: Medal },
  { min: 250_000, label: 'Elite', icon: Trophy },
  { min: 500_000, label: 'Lenda', icon: Crown },
  { min: 1_000_000, label: 'Milionário', icon: Gem },
]

function getCurrentBadge(totalSales: number) {
  for (let i = BADGES.length - 1; i >= 0; i--) {
    if (totalSales >= BADGES[i].min) return BADGES[i]
  }
  return BADGES[0]
}

function getNextBadge(totalSales: number) {
  for (const badge of BADGES) {
    if (totalSales < badge.min) return badge
  }
  return null
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`
  return `R$ ${value.toFixed(0)}`
}

export function SalesGoalCard({ totalSales }: SalesGoalCardProps) {
  const goalStart = Math.floor(totalSales / STEP) * STEP
  const goalEnd = goalStart + STEP
  const progressPct = Math.min(((totalSales - goalStart) / STEP) * 100, 100)
  const currentBadge = getCurrentBadge(totalSales)
  const nextBadge = getNextBadge(totalSales)

  const BadgeIcon = currentBadge.icon

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm h-full flex flex-col justify-between relative overflow-hidden">
      <div className="flex items-center justify-between mb-3 relative z-10">
        <span className="text-xs font-bold text-muted uppercase tracking-wider">Meta de Vendas</span>
        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
          <TrendingUp className="h-3 w-3" />
          {progressPct >= 50 ? '+12.3% vs mês ant.' : 'Em progresso'}
        </span>
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
              <p className="text-sm font-black text-foreground">{currentBadge.label}</p>
              <p className="text-[11px] text-muted">Excelente progresso!</p>
            </div>
          </div>

          <div className="mt-2 w-full pt-2 border-t border-border/50">
            <p className="text-xs font-bold text-foreground">
              {formatCompact(totalSales)} <span className="text-muted font-normal">/ {formatCompact(goalEnd)}</span>
            </p>
            {nextBadge && (
              <p className="text-[11px] text-primary font-semibold mt-0.5 truncate">
                Próximo nível: {nextBadge.label} ({formatCompact(nextBadge.min)})
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
