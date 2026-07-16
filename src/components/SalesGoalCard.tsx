'use client'

import { Trophy, Star, Award, Medal, Target, Crown, Gem } from 'lucide-react'

interface SalesGoalCardProps {
  totalSales: number
  variant?: 'compact' | 'full'
}

const STEP = 10_000

const BADGES = [
  { min: 0, label: 'Iniciante', icon: Target, color: 'text-slate-400', bg: 'bg-slate-100' },
  { min: 10_000, label: 'Vendedor', icon: Star, color: 'text-amber-500', bg: 'bg-amber-50' },
  { min: 50_000, label: 'Top Vendedor', icon: Award, color: 'text-orange-500', bg: 'bg-orange-50' },
  { min: 100_000, label: 'Expert', icon: Medal, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { min: 250_000, label: 'Elite', icon: Trophy, color: 'text-blue-500', bg: 'bg-blue-50' },
  { min: 500_000, label: 'Lenda', icon: Crown, color: 'text-purple-500', bg: 'bg-purple-50' },
  { min: 1_000_000, label: 'Milionário', icon: Gem, color: 'text-pink-500', bg: 'bg-pink-50' },
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

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`
  return `R$ ${value.toFixed(0)}`
}

export function SalesGoalCard({ totalSales, variant = 'compact' }: SalesGoalCardProps) {
  const goalStart = Math.floor(totalSales / STEP) * STEP
  const goalEnd = goalStart + STEP
  const progressPct = Math.min(((totalSales - goalStart) / STEP) * 100, 100)
  const remaining = Math.max(0, goalEnd - totalSales)
  const currentBadge = getCurrentBadge(totalSales)
  const nextBadge = getNextBadge(totalSales)

  const BadgeIcon = currentBadge.icon

  if (variant === 'compact') {
    return (
      <div className="hidden min-w-[190px] rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm md:block">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <Target className="h-3.5 w-3.5 text-orange-600" />
            Meta
          </span>
          <span className="text-xs font-black text-orange-600">{formatCurrency(totalSales)} / {formatCurrency(goalEnd)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] text-slate-400">Faltam {formatCurrency(remaining)} para a proxima meta</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900">Progresso de Vendas</h3>
        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${currentBadge.color} ${currentBadge.bg}`}>
          <BadgeIcon className="h-3.5 w-3.5" />
          {currentBadge.label}
        </span>
      </div>

      <div className="flex items-center gap-8">
        <div className="relative w-40 h-40" role="img" aria-label={`Progresso: ${progressPct.toFixed(0)}%`}>
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" fill="none" r="45" stroke="#f1f5f9" strokeWidth="8" />
            <circle
              className="transition-all duration-1000 ease-out"
              cx="50" cy="50" fill="none" r="45"
              stroke="#f97316"
              strokeDasharray="282.7"
              strokeDashoffset={282.7 - (282.7 * progressPct) / 100}
              strokeLinecap="round"
              strokeWidth="8"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-slate-900">{progressPct.toFixed(0)}%</span>
            <span className="text-xs font-bold text-slate-500">{formatCurrency(goalEnd)}</span>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <p className="text-sm font-bold text-slate-500">Vendas no período</p>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(totalSales)}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">Próxima meta</p>
            <p className="text-lg font-black text-orange-600">{formatCurrency(remaining)} restantes</p>
          </div>
          {nextBadge && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Próxima conquista</p>
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${nextBadge.bg}`}>
                  <nextBadge.icon className={`h-4 w-4 ${nextBadge.color}`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">{nextBadge.label}</p>
                  <p className="text-[10px] text-slate-400">Faltam {formatCurrency(nextBadge.min - totalSales)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}