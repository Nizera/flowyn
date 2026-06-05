"use client"

import { useState, useRef, useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import Link from 'next/link'
import { Bell, Menu, X, Target, BellOff, CalendarClock } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

interface AppLayoutUIProps {
  children: React.ReactNode
  profile: any
  user: any
  totalSales: number
  subscription?: {
    status: string
    trial_ends_at: string | null
    grace_period_ends_at: string | null
  } | null
}


function formatCurrency(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`
  return `R$ ${value.toFixed(0)}`
}

function SalesGoal({ totalSales }: { totalSales: number }) {
  // Milestone: 0→10k, then 10k→20k, 20k→30k ...
  const STEP = 10_000
  const goalStart = Math.floor(totalSales / STEP) * STEP
  const goalEnd = goalStart + STEP
  const progressPct = Math.min(((totalSales - goalStart) / STEP) * 100, 100)
  const remaining = goalEnd - totalSales

  return (
    <div className="flex flex-col justify-center min-w-[160px] max-w-[220px]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-[#00e88a]" />
          <span className="text-xs font-semibold text-white/60">Meta</span>
        </div>
        <span className="text-xs font-bold text-[#00e88a]">
          {formatCurrency(totalSales)} / {formatCurrency(goalEnd)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #00e88a, #00c874)',
            boxShadow: '0 0 8px rgba(0,232,138,0.5)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      <p className="text-[10px] text-white/30 mt-1">
        Faltam {formatCurrency(remaining)} para a próxima meta
      </p>
    </div>
  )
}

// Placeholder notifications — in future, replace with real DB fetch
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
      className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#00e88a]/25 bg-[#00e88a]/10 px-4 py-3 text-sm text-[#c7ffe3] transition hover:bg-[#00e88a]/15 md:mx-8"
    >
      <span className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-[#00e88a]" />
        <span className="font-semibold">{text}</span>
      </span>
      <span className="shrink-0 text-xs font-black uppercase text-[#00e88a]">Ver assinatura</span>
    </Link>
  )
}

const MOCK_NOTIFICATIONS: { id: number; title: string; body: string; time: string; read: boolean }[] = []

export function AppLayoutUI({ children, profile, user, totalSales, subscription }: AppLayoutUIProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  // Close notif dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col md:flex-row relative">
      
      {/* Background Noise */}
      <div 
        className="fixed inset-0 z-0 opacity-10 pointer-events-none" 
        style={{ backgroundImage: 'url("/noise.png")', backgroundRepeat: 'repeat' }}
      />

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-shrink-0 z-20">
        <Sidebar profile={profile} />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed inset-y-0 left-0 w-[280px] z-50 md:hidden flex"
              onClick={(e) => {
                if ((e.target as HTMLElement).tagName === 'A' || (e.target as HTMLElement).closest('a')) {
                  setIsMobileMenuOpen(false)
                }
              }}
            >
              <Sidebar profile={profile} />
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-[-48px] w-10 h-10 bg-[#111] border border-white/10 rounded-xl flex items-center justify-center text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 z-10 relative">
        
        {/* Top Navigation */}
        <header className="h-16 md:h-20 bg-[#111111]/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
          
          {/* Left: Hamburger (mobile) */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-white/70 hover:text-white transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          {/* Right: Sales Goal + Bell */}
          <div className="flex items-center gap-4 md:gap-6">

            {/* Sales Goal — hidden on mobile */}
            <div className="hidden md:flex items-center">
              <SalesGoal totalSales={totalSales} />
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-8 bg-white/10" />

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotifOpen(prev => !prev)}
                className="relative p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all"
              >
                <Bell className="w-5 h-5 md:w-5 md:h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#00e88a] rounded-full shadow-[0_0_8px_#00e88a]" />
                )}
              </button>

              {/* Notification Dropdown */}
              <AnimatePresence>
                {isNotifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute right-0 top-full mt-2 w-80 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                      <span className="font-bold text-sm text-white">Notificações</span>
                      {unreadCount > 0 && (
                        <span className="text-xs font-bold text-[#00e88a] bg-[#00e88a]/10 px-2 py-0.5 rounded-full">
                          {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Notifications list */}
                    {MOCK_NOTIFICATIONS.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                          <BellOff className="w-5 h-5 text-white/20" />
                        </div>
                        <p className="text-sm font-semibold text-white/40">Nenhuma notificação</p>
                        <p className="text-xs text-white/20 mt-1">Você está em dia! As atualizações aparecem aqui.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                        {MOCK_NOTIFICATIONS.map(n => (
                          <div
                            key={n.id}
                            className={`px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer ${!n.read ? 'bg-[#00e88a]/5' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              {!n.read && (
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#00e88a] flex-shrink-0" />
                              )}
                              <div className={!n.read ? '' : 'pl-3'}>
                                <p className="text-sm font-semibold text-white leading-tight">{n.title}</p>
                                <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{n.body}</p>
                                <p className="text-[10px] text-white/30 mt-1">{n.time}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="border-t border-white/5 px-4 py-2.5">
                      <button className="text-xs text-white/30 hover:text-white/60 transition-colors w-full text-center">
                        Ver todas as notificações
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <SubscriptionBanner subscription={subscription} />

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-full">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
