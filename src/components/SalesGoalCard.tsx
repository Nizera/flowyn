'use client'

import { Target, Star, Award, Medal, Trophy, Crown, Gem } from 'lucide-react'

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
  const remaining = Math.max(0, goalEnd - totalSales)
  const currentBadge = getCurrentBadge(totalSales)
  const nextBadge = getNextBadge(totalSales)

  const BadgeIcon = currentBadge.icon

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm h-[140px]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Meta de Vendas</span>
        <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
          <BadgeIcon className="h-3 w-3" />
          {currentBadge.label}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20" role="img" aria-label={`Progresso: ${progressPct.toFixed(0)}%`}>
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" fill="none" r="40" stroke="#f1f5f9" strokeWidth="10" />
            <circle
              className="transition-all duration-700 ease-out"
              cx="50" cy="50" fill="none" r="40"
              stroke="#f97316"
              strokeDasharray="251.2"
              strokeDashoffset={251.2 - (251.2 * progressPct) / 100}
              strokeLinecap="round"
              strokeWidth="10"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black text-slate-900">{progressPct.toFixed(0)}%</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400">Vendas</p>
          <p className="text-base font-black text-slate-900">{formatCompact(totalSales)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Faltam {formatCompact(remaining)}</p>
          {nextBadge && (
            <p className="text-[10px] text-orange-500 font-bold mt-0.5">
              Próximo: {nextBadge.label}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
