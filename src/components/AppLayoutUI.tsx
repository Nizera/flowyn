"use client"

import { useEffect, useRef, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import Link from 'next/link'
import { Bell, CalendarClock, DollarSign, Clock, AlertTriangle, Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

type UserProfile = {
  full_name?: string | null
  email?: string | null
}

type Notification = {
  id: string
  title: string
  body: string
  time: string
  read: boolean
  href?: string
}

interface AppLayoutUIProps {
  children: React.ReactNode
  profile: UserProfile | null
  subscription?: {
    status: string
    trial_ends_at: string | null
    grace_period_ends_at: string | null
  } | null
  notifications: Notification[]
}

const pageTitles: { match: string; title: string; subtitle: string }[] = [
  { match: '/dashboard/products/new', title: 'Criar produto', subtitle: 'Configure oferta, preco, entrega e checkout.' },
  { match: '/dashboard/products', title: 'Produtos', subtitle: 'Gerencie os infoprodutos publicados na Flowyn.' },
  { match: '/dashboard/settings/payments', title: 'Pagamentos', subtitle: 'Conecte sua carteira Asaas e acompanhe o status.' },
  { match: '/dashboard/sales', title: 'Vendas', subtitle: 'Pedidos, pagamentos e liberacao de acesso.' },
  { match: '/dashboard/wallet', title: 'Carteira', subtitle: 'Saldo e recebiveis via Asaas.' },
  { match: '/dashboard/pixels', title: 'Pixels', subtitle: 'Rastreamento e conversoes dos checkouts.' },
  { match: '/dashboard/settings/subscription', title: 'Assinatura', subtitle: 'Plano Flowyn e cobranca mensal.' },
  { match: '/dashboard/settings/profile', title: 'Minha conta', subtitle: 'Dados do usuario e preferencias.' },
  { match: '/learn', title: 'Meus acessos', subtitle: 'Cursos, arquivos e mentorias comprados.' },
  { match: '/dashboard/referrals', title: 'Indicar', subtitle: 'Ganhe 20% comissao em cada cliente indicado.' },
  { match: '/dashboard', title: 'Visao geral', subtitle: 'Acompanhe sua operacao de vendas.' },
]

function formatShortDate(value: string | null | undefined) {
  if (!value) return ''
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value))
}

function SubscriptionBanner({ subscription }: { subscription: AppLayoutUIProps['subscription'] }) {
  if (!subscription || subscription.status === 'active') return null

  const isTrial = subscription.status === 'trialing'
  const isScheduled = subscription.status === 'scheduled'
  const isGrace = subscription.status === 'grace_period'
  const isBlocked = ['suspended', 'cancelled'].includes(subscription.status)

  if (!isTrial && !isScheduled && !isGrace && !isBlocked) return null

  const text = isTrial
    ? `Seu teste gratis termina em ${formatShortDate(subscription.trial_ends_at)}.`
    : isScheduled
      ? `Mensalidade configurada. Primeiro ciclo em ${formatShortDate(subscription.trial_ends_at)}.`
      : isGrace
        ? `Regularize ate ${formatShortDate(subscription.grace_period_ends_at)} para manter os checkouts ativos.`
        : 'Assinatura pendente. Regularize para manter produtos e checkouts ativos.'

  return (
    <Link
      href="/dashboard/settings/subscription"
      className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 transition hover:bg-orange-100 md:mx-8"
    >
      <span className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4" />
        <span className="font-semibold">{text}</span>
      </span>
      <span className="shrink-0 text-xs font-black uppercase">Ver assinatura</span>
    </Link>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(dateStr))
}

function notifIcon(id: string) {
  if (id.startsWith('sale-')) return <DollarSign className="h-4 w-4 text-emerald-600" />
  if (id.startsWith('pending-')) return <Clock className="h-4 w-4 text-amber-600" />
  return <AlertTriangle className="h-4 w-4 text-orange-600" />
}

function notifBg(id: string) {
  if (id.startsWith('sale-')) return 'bg-emerald-50'
  if (id.startsWith('pending-')) return 'bg-amber-50'
  return 'bg-orange-50'
}

export function AppLayoutUI({ children, profile, subscription, notifications }: AppLayoutUIProps) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const unreadCount = notifications.filter(n => !n.read).length
  const page = pageTitles.find(item => pathname === item.match || pathname.startsWith(`${item.match}/`)) || pageTitles[pageTitles.length - 1]
  const isLearningExperience = pathname === '/learn' || pathname.startsWith('/learn/')

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setIsNotifOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (isLearningExperience) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#070809] text-white">
        {children}
      </main>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#f6f7f9] text-slate-950 md:flex-row">
      <div className="hidden shrink-0 md:block w-64" />

      <div className="fixed inset-y-0 left-0 z-40 hidden md:flex w-64">
        <Sidebar profile={profile} />
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] md:hidden"
            >
              <Sidebar profile={profile} />
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute right-[-48px] top-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white text-slate-700 shadow-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl md:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 md:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black text-slate-950 md:text-2xl">{page.title}</h1>
              <p className="mt-0.5 truncate text-sm text-slate-400">{page.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotifOpen(prev => !prev)}
                className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-950"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500" />}
              </button>
              <AnimatePresence>
                {isNotifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <span className="text-sm font-black text-slate-950">Notificacoes</span>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50">
                          <Bell className="h-5 w-5 text-slate-300" />
                        </div>
                        <p className="text-sm font-bold text-slate-500">Nenhuma notificacao</p>
                        <p className="mt-1 text-xs text-slate-400">Atualizacoes importantes aparecem aqui.</p>
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.map((n) => (
                          n.href ? (
                            <Link
                              key={n.id}
                              href={n.href}
                              className={`flex items-start gap-3 border-b border-slate-50 px-4 py-3 transition hover:bg-slate-50 ${n.read ? 'opacity-60' : ''}`}
                              onClick={() => setIsNotifOpen(false)}
                            >
                              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${notifBg(n.id)}`}>
                                {notifIcon(n.id)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-900">{n.title}</p>
                                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 line-clamp-2">{n.body}</p>
                                <p className="mt-1 text-[10px] font-medium text-slate-400">{timeAgo(n.time)}</p>
                              </div>
                            </Link>
                          ) : (
                            <div
                              key={n.id}
                              className={`flex items-start gap-3 border-b border-slate-50 px-4 py-3 transition hover:bg-slate-50 ${n.read ? 'opacity-60' : ''}`}
                            >
                              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${notifBg(n.id)}`}>
                                {notifIcon(n.id)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-900">{n.title}</p>
                                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 line-clamp-2">{n.body}</p>
                                <p className="mt-1 text-[10px] font-medium text-slate-400">{timeAgo(n.time)}</p>
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <SubscriptionBanner subscription={subscription} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}