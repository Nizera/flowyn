'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Target, Star, Award, Medal, Trophy, Crown, Gem,
  TrendingUp, ChevronLeft, Download, Gift, Lock, CheckCircle,
  Package, Flame
} from 'lucide-react'

interface BadgeReward {
  badge_type: string
  label: string
  description: string
  icon_name: string
  min_sales: number
  physical_reward_name: string | null
  physical_reward_cost: number
  functional_reward: string
  requires_address: boolean
  achieved: boolean
  achieved_at: string | null
  reward_claimed: boolean
  reward_delivered: boolean
  tracking_code: string | null
  is_next: boolean
}

interface GoalsData {
  total_sales: number
  current_badge: BadgeReward | null
  next_badge: BadgeReward | null
  badges: BadgeReward[]
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

const BADGE_COLORS: Record<string, string> = {
  iniciante: 'from-slate-500 to-slate-600',
  vendedor: 'from-amber-500 to-orange-500',
  top_vendedor: 'from-orange-500 to-red-500',
  expert: 'from-purple-500 to-pink-500',
  lenda: 'from-yellow-400 to-amber-500',
  milionario: 'from-cyan-400 to-blue-500',
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`
  return `R$ ${value.toFixed(0)}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function GoalsPage() {
  const [data, setData] = useState<GoalsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [claimingBadge, setClaimingBadge] = useState<string | null>(null)
  const [showAddressModal, setShowAddressModal] = useState<string | null>(null)
  const [address, setAddress] = useState({
    full_name: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [streak] = useState(45) // TODO: Calcular streak real

  useEffect(() => {
    fetchGoals()
  }, [])

  async function fetchGoals() {
    try {
      const res = await fetch('/api/goals')
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch (e) {
      console.error('Error fetching goals:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleClaim(badgeType: string) {
    const badge = data?.badges.find(b => b.badge_type === badgeType)
    if (!badge) return

    if (badge.requires_address) {
      setShowAddressModal(badgeType)
      return
    }

    setClaimingBadge(badgeType)
    try {
      const res = await fetch('/api/goals/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badge_type: badgeType }),
      })
      if (res.ok) {
        fetchGoals()
      }
    } catch (e) {
      console.error('Error claiming:', e)
    } finally {
      setClaimingBadge(null)
    }
  }

  async function handleSubmitAddress() {
    if (!showAddressModal) return

    setSubmitting(true)
    try {
      const addrRes = await fetch('/api/goals/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(address),
      })

      if (!addrRes.ok) throw new Error('Erro ao salvar endereço')

      const claimRes = await fetch('/api/goals/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          badge_type: showAddressModal,
          address,
        }),
      })

      if (claimRes.ok) {
        setShowAddressModal(null)
        fetchGoals()
      }
    } catch (e) {
      console.error('Error:', e)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm text-muted font-medium">Carregando conquistas...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted">Erro ao carregar dados</p>
      </div>
    )
  }

  const achievedCount = data.badges.filter(b => b.achieved).length
  const totalBadges = data.badges.length

  // Calcular progresso para próxima meta
  const nextGoalProgress = data.next_badge
    ? Math.min(
        ((data.total_sales - (data.current_badge?.min_sales || 0)) /
          (data.next_badge.min_sales - (data.current_badge?.min_sales || 0))) *
          100,
        100
      )
    : 100

  const nextGoalRemaining = data.next_badge
    ? Math.max(data.next_badge.min_sales - data.total_sales, 0)
    : 0

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl hover:bg-surface transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-muted" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-foreground">Minhas Conquistas</h1>
            <p className="text-sm text-muted">Acompanhe sua jornada de vendas</p>
          </div>
        </div>
      </div>

      {/* Resumo Geral */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-3xl font-black text-foreground">{formatCompact(data.total_sales)}</p>
            <p className="text-xs font-bold text-muted mt-1">Total Faturado</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-foreground">{achievedCount}/{totalBadges}</p>
            <p className="text-xs font-bold text-muted mt-1">Badges</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-foreground flex items-center justify-center gap-2">
              <Flame className="h-6 w-6 text-orange-500" />
              {streak}
            </p>
            <p className="text-xs font-bold text-muted mt-1">Sequência</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-primary">
              {data.current_badge?.label || 'Iniciante'}
            </p>
            <p className="text-xs font-bold text-muted mt-1">Nível Atual</p>
          </div>
        </div>
      </div>

      {/* Próxima Meta */}
      {data.next_badge && (
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-4">Próxima Meta</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Donut Chart */}
            <div className="flex justify-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" fill="none" r="40" stroke="currentColor" className="text-surface" strokeWidth="12" />
                  <circle
                    className="transition-all duration-700 ease-out text-primary"
                    cx="50" cy="50" fill="none" r="40"
                    stroke="currentColor"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * nextGoalProgress) / 100}
                    strokeLinecap="round"
                    strokeWidth="12"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-foreground">{Math.round(nextGoalProgress)}%</span>
                  <span className="text-xs font-medium text-muted">da meta</span>
                </div>
              </div>
            </div>

            {/* Info da Meta */}
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-lg font-black text-foreground">{data.next_badge.label}</p>
                <p className="text-sm text-muted">({formatCompact(data.next_badge.min_sales)})</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="text-muted">Título:</span>
                  <span className="font-bold text-foreground">"{data.next_badge.label}"</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-muted">Funcional:</span>
                  <span className="font-bold text-foreground">{data.next_badge.functional_reward}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Gift className="h-4 w-4 text-amber-500" />
                  <span className="text-muted">Brinde:</span>
                  <span className="font-bold text-foreground">{data.next_badge.physical_reward_name}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted">Progresso</span>
                  <span className="font-bold text-foreground">
                    {formatCompact(data.total_sales)} / {formatCompact(data.next_badge.min_sales)}
                  </span>
                </div>
                <div className="w-full h-3 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-primary rounded-full transition-all duration-500"
                    style={{ width: `${nextGoalProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted mt-2">
                  Faltam <span className="font-bold text-foreground">{formatCompact(nextGoalRemaining)}</span> para desbloquear
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trilha de Conquistas */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <h3 className="text-sm font-bold text-foreground mb-6">Trilha de Conquistas</h3>
        <div className="flex items-center justify-between relative px-4">
          {/* Linha de progresso */}
          <div className="absolute top-5 left-4 right-4 h-1 bg-surface rounded-full" />
          <div
            className="absolute top-5 left-4 h-1 bg-gradient-to-r from-orange-500 to-primary rounded-full transition-all duration-500"
            style={{ width: `${(achievedCount / (totalBadges - 1)) * 100}%` }}
          />

          {data.badges.map((badge) => {
            const Icon = ICON_MAP[badge.icon_name] || Target
            return (
              <div key={badge.badge_type} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    badge.achieved
                      ? 'bg-gradient-to-br ' + BADGE_COLORS[badge.badge_type] + ' border-transparent text-white'
                      : 'bg-surface border-border text-muted'
                  }`}
                >
                  {badge.achieved ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span className="text-[10px] font-bold text-muted mt-2 text-center max-w-[70px]">
                  {badge.label}
                </span>
                <span className="text-[9px] text-muted/70">
                  {badge.min_sales === 0 ? '1ª venda' : formatCompact(badge.min_sales)}
                </span>
                <span className={`text-[9px] font-bold mt-1 ${badge.achieved ? 'text-emerald-500' : badge.is_next ? 'text-primary' : 'text-muted/50'}`}>
                  {badge.achieved ? '✓ Conq.' : badge.is_next ? 'Próx.' : 'Bloq.'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Lista de Conquistas */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-foreground">Suas Conquistas</h3>

        {data.badges.sort((a, b) => a.min_sales - b.min_sales).map((badge) => {
          const Icon = ICON_MAP[badge.icon_name] || Target
          const progressPct = badge.min_sales > 0
            ? Math.min((data.total_sales / badge.min_sales) * 100, 100)
            : 100

          return (
            <div
              key={badge.badge_type}
              className={`bg-card rounded-2xl p-5 border shadow-sm transition-all ${
                badge.achieved
                  ? 'border-border'
                  : 'border-border/50 opacity-75'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Badge Icon */}
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                    badge.achieved
                      ? 'bg-gradient-to-br ' + BADGE_COLORS[badge.badge_type] + ' text-white'
                      : 'bg-surface text-muted'
                  }`}
                >
                  {badge.achieved ? (
                    <CheckCircle className="h-7 w-7" />
                  ) : (
                    <Icon className="h-7 w-7" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-base font-black text-foreground">{badge.label}</h4>
                    {badge.achieved && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Conquistado
                      </span>
                    )}
                    {!badge.achieved && badge.is_next && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        Próximo
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted mb-2">{badge.description}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-muted">
                      <Gift className="h-3 w-3" />
                      <span>{badge.physical_reward_name || 'Placa PDF'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted">
                      <TrendingUp className="h-3 w-3" />
                      <span>{badge.functional_reward}</span>
                    </div>
                  </div>

                  {badge.achieved && badge.achieved_at && (
                    <p className="text-[10px] text-muted mt-2">
                      Conquistado em: {formatDate(badge.achieved_at)}
                    </p>
                  )}

                  {/* Progress bar */}
                  {!badge.achieved && badge.min_sales > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-muted">Progresso</span>
                        <span className="font-bold text-foreground">
                          {formatCompact(data.total_sales)} / {formatCompact(badge.min_sales)}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-primary rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="shrink-0 flex flex-col gap-2">
                  {badge.achieved && (
                    <a
                      href={`/api/goals/certificate?badge=${badge.badge_type}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-surface border border-border text-foreground px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-surface/80 transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      {badge.badge_type === 'iniciante' ? 'Baixar Placa' : 'Ver Certificado'}
                    </a>
                  )}
                  {badge.achieved && !badge.reward_claimed && badge.badge_type !== 'iniciante' && (
                    <button
                      onClick={() => handleClaim(badge.badge_type)}
                      disabled={claimingBadge === badge.badge_type}
                      className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {claimingBadge === badge.badge_type ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Package className="h-3 w-3" />
                      )}
                      Resgatar Prêmio
                    </button>
                  )}
                  {badge.achieved && badge.reward_claimed && !badge.reward_delivered && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                      <Package className="h-3 w-3" />
                      Em preparo
                    </span>
                  )}
                  {badge.achieved && badge.reward_delivered && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle className="h-3 w-3" />
                      Entregue
                    </span>
                  )}
                  {!badge.achieved && (
                    <Lock className="h-5 w-5 text-muted" />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de Endereço */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md border border-border shadow-xl">
            <h3 className="text-lg font-black text-foreground mb-1">Resgatar Prêmio</h3>
            <p className="text-sm text-muted mb-4">
              Preencha seu endereço para entrega
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">Nome completo</label>
                <input
                  type="text"
                  value={address.full_name}
                  onChange={e => setAddress({ ...address, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-[1fr,80px] gap-2">
                <div>
                  <label className="text-[11px] font-bold text-muted block mb-1">Endereço</label>
                  <input
                    type="text"
                    value={address.street}
                    onChange={e => setAddress({ ...address, street: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted block mb-1">Número</label>
                  <input
                    type="text"
                    value={address.number}
                    onChange={e => setAddress({ ...address, number: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">Complemento</label>
                <input
                  type="text"
                  value={address.complement}
                  onChange={e => setAddress({ ...address, complement: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">Bairro</label>
                <input
                  type="text"
                  value={address.neighborhood}
                  onChange={e => setAddress({ ...address, neighborhood: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-[1fr,60px] gap-2">
                <div>
                  <label className="text-[11px] font-bold text-muted block mb-1">Cidade</label>
                  <input
                    type="text"
                    value={address.city}
                    onChange={e => setAddress({ ...address, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted block mb-1">UF</label>
                  <input
                    type="text"
                    value={address.state}
                    onChange={e => setAddress({ ...address, state: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-[1fr,1fr] gap-2">
                <div>
                  <label className="text-[11px] font-bold text-muted block mb-1">CEP</label>
                  <input
                    type="text"
                    value={address.zip_code}
                    onChange={e => setAddress({ ...address, zip_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted block mb-1">Telefone</label>
                  <input
                    type="text"
                    value={address.phone}
                    onChange={e => setAddress({ ...address, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddressModal(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-surface border border-border text-sm font-bold text-muted hover:bg-surface/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitAddress}
                disabled={submitting}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Salvando...' : 'Confirmar Entrega'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
