"use client"

import Link from 'next/link'
import { signOutAction } from '@/app/(app)/actions'
import { usePathname } from 'next/navigation'
import {
  BadgeCheck,
  Box,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PlusCircle,
  ScanLine,
  Settings,
  ShoppingBag,
  PlaySquare,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

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

type SidebarProfile = {
  full_name?: string | null
} | null

export function Sidebar({ profile }: { profile: SidebarProfile }) {
  const pathname = usePathname()
  const isActive = (href: string, exact?: boolean, exclude?: string) => {
    if (exclude && pathname.startsWith(exclude)) return false
    return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <aside className="flex h-screen w-full flex-col overflow-y-auto border-r border-slate-200 bg-white sidebar-scrollbar">
      <Link href="/dashboard" className="flex h-20 items-center justify-center border-b border-slate-200 px-4 lg:justify-start">
        <img src="/brand/logo-light.png" alt="Flowyn" className="h-10 w-auto lg:h-11" />
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sidebar-scrollbar">
        {sections.map(section => (
          <div key={section.label}>
            <p className="mb-2 px-2 text-[11px] font-black uppercase tracking-wide text-slate-400">{section.label}</p>
            <div className="space-y-1">
              {section.items.map(item => {
                const Icon = item.icon
                const active = isActive(item.href, item.exact, item.exclude)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                      active
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
                    }`}
                  >
                    {active && <span className="absolute left-0 h-6 w-1 rounded-r-full bg-gradient-to-r from-orange-500 to-amber-500" />}
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-4">
        {profile && (
          <div className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-black text-white">
              {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">{profile.full_name || 'Usuario'}</p>
              <p className="truncate text-xs text-slate-400">Conta Flowyn</p>
            </div>
          </div>
        )}
        <form action={signOutAction}>
          <button type="submit" className="flex h-11 w-full items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600">
            <LogOut className="h-5 w-5" />
            <span>Sair da Conta</span>
          </button>
        </form>
      </div>
    </aside>
  )
}