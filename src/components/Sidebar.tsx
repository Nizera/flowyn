"use client"

import Link from 'next/link'
import { signOutAction } from '@/app/(app)/actions'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  BadgeCheck,
  Box,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  ScanLine,
  Settings,
  ShoppingBag,
  PlaySquare,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { Logo } from './Logo'
import { FlowynIcon } from './FlowynIcon'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  exclude?: string
}

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operacao',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/dashboard/wallet', label: 'Carteira', icon: Wallet },
      { href: '/learn', label: 'Meus Acessos', icon: PlaySquare },
    ],
  },
  {
    label: 'Produtos',
    items: [
      { href: '/dashboard/products/new', label: 'Criar Produto', icon: PlusCircle },
      { href: '/dashboard/products', label: 'Meus Produtos', icon: Box, exclude: '/dashboard/products/new' },
      { href: '/dashboard/sales', label: 'Minhas Vendas', icon: ShoppingBag },
      { href: '/dashboard/ads', label: 'Meta Ads', icon: Megaphone },
      { href: '/dashboard/diagnostics', label: 'Diagnóstico', icon: ScanLine },
      { href: '/dashboard/referrals', label: 'Indicar', icon: Users },
      { href: '/dashboard/goals', label: 'Conquistas', icon: Trophy },
    ],
  },
  {
    label: 'Configuracoes',
    items: [
      { href: '/dashboard/pixels', label: 'Pixels', icon: ScanLine },
      { href: '/dashboard/settings/payments', label: 'Pagamentos', icon: CreditCard },
      { href: '/dashboard/settings/subscription', label: 'Assinatura', icon: BadgeCheck },
      { href: '/dashboard/settings/profile', label: 'Minha Conta', icon: Settings },
    ],
  },
]

export const SIDEBAR_STORAGE_KEY = 'flowyn_sidebar_collapsed'

export const SIDEBAR_WIDTH_EXPANDED = 256
export const SIDEBAR_WIDTH_COLLAPSED = 72

type SidebarProfile = {
  full_name?: string | null
} | null

export function Sidebar({ profile }: { profile: SidebarProfile }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [tooltipEl, setTooltipEl] = useState<{ label: string; top: number } | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      if (stored !== null) setCollapsed(stored === 'true')
    } catch {}
  }, [])

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)) } catch {}
      window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed: next } }))
      setTooltipEl(null)
      return next
    })
  }

  const isActive = (href: string, exact?: boolean, exclude?: string) => {
    if (exclude && pathname.startsWith(exclude)) return false
    return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
  }

  const showTooltip = (label: string, e: React.MouseEvent) => {
    if (!collapsed) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltipEl({ label, top: rect.top + rect.height / 2 })
  }

  const hideTooltip = () => setTooltipEl(null)

  return (
    <>
      <aside className={`flex h-screen flex-col border-r border-border bg-background transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        <Link href="/dashboard" className={`flex h-20 shrink-0 items-center border-b border-border px-4 ${collapsed ? 'justify-center' : 'justify-start'}`}>
          {collapsed ? (
            <img src="/brand/favicon.png" alt="Flowyn" className="h-9 w-9 object-contain" />
          ) : (
            <Logo className="h-10 w-auto lg:h-11" />
          )}
        </Link>

        <nav className="flex-1 overflow-y-auto px-2 py-5 sidebar-scrollbar">
          {sections.map(section => (
            <div key={section.label} className="mb-6">
              {!collapsed && (
                <p className="mb-2 px-2 text-[11px] font-black uppercase tracking-wide text-muted">{section.label}</p>
              )}
              <div className="space-y-1">
                {section.items.map(item => {
                  const Icon = item.icon
                  const active = isActive(item.href, item.exact, item.exclude)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-tour={item.href === '/dashboard/products/new' ? 'tour-create-product' : item.href === '/dashboard/products' ? 'tour-my-products' : item.href === '/dashboard/settings/payments' ? 'tour-payments' : item.href === '/dashboard/ads' ? 'tour-meta-ads' : undefined}
                      onMouseEnter={(e) => showTooltip(item.label, e)}
                      onMouseLeave={hideTooltip}
                      className={`relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted hover:bg-surface hover:text-foreground'
                      } ${collapsed ? 'justify-center' : ''}`}
                    >
                      {active && <span className="absolute left-0 h-6 w-1 rounded-r-full bg-gradient-to-r from-orange-500 to-amber-500" />}
                      <Icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-2">
          <button
            onClick={toggleCollapsed}
            onMouseEnter={(e) => showTooltip(collapsed ? 'Expandir menu' : 'Recolher menu', e)}
            onMouseLeave={hideTooltip}
            className={`relative flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted transition hover:bg-surface hover:text-foreground ${collapsed ? 'justify-center' : ''}`}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-5 w-5 shrink-0" />
                <span>Recolher</span>
              </>
            )}
          </button>
        </div>

        <div className="shrink-0 border-t border-border p-4">
          {profile && (
            <div className={`mb-3 flex items-center rounded-xl px-3 py-2 ${collapsed ? 'justify-center' : 'gap-3'}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-black text-white">
                {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{profile.full_name || 'Usuario'}</p>
                  <p className="truncate text-xs text-muted">Conta Flowyn</p>
                </div>
              )}
              {!collapsed && <ThemeToggle />}
            </div>
          )}
          {collapsed && (
            <div className="mb-3 flex justify-center">
              <ThemeToggle />
            </div>
          )}
          <form action={signOutAction}>
            <button
              type="submit"
              onMouseEnter={(e) => showTooltip('Sair da Conta', e)}
              onMouseLeave={hideTooltip}
              className={`relative flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted transition hover:bg-red-500/10 hover:text-red-500 ${collapsed ? 'justify-center' : ''}`}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Sair da Conta</span>}
            </button>
          </form>
        </div>
      </aside>

      {tooltipEl && (
        <div
          className="pointer-events-none fixed z-[100] ml-2 whitespace-nowrap rounded-lg bg-surface-elevated px-3 py-1.5 text-xs font-bold text-foreground shadow-lg ring-1 ring-border"
          style={{ top: tooltipEl.top, left: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
        >
          {tooltipEl.label}
        </div>
      )}
    </>
  )
}
