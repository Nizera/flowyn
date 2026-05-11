"use client"

import Link from 'next/link'
import { signOutAction } from '@/app/(app)/actions'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Store, Box, Link2, Bell, User, Settings, LogOut, DollarSign, Webhook, CreditCard, BookOpen, ScanLine, Wallet } from 'lucide-react'

// Receives props from the server layout
export function Sidebar({ isAffiliate, isProducer }: { isAffiliate: boolean, isProducer: boolean }) {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <aside className="w-full md:w-64 bg-[#111111] md:bg-transparent border-r border-white/10 text-white flex-shrink-0 flex flex-col z-20 h-full">
      <div className="p-6 flex items-center cursor-pointer">
         <img src="/logo2.png" alt="Flowyn" className="h-20 w-auto" />
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${pathname === '/dashboard' ? 'bg-[#00e88a]/10 text-[#00e88a]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
          <LayoutDashboard className="w-5 h-5" />
          <span className="font-medium text-sm">Dashboard</span>
        </Link>
        <Link href="/dashboard/wallet" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive('/dashboard/wallet') ? 'bg-[#00e88a]/10 text-[#00e88a]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
          <Wallet className="w-5 h-5" />
          <span className="font-medium text-sm">Carteira</span>
        </Link>

        {isAffiliate && (
          <>
            <div className="pt-4 pb-2">
              <span className="px-3 text-xs font-semibold text-white/30 uppercase tracking-wider">Afiliado</span>
            </div>
            <Link href="/market" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive('/market') ? 'bg-[#00e88a]/10 text-[#00e88a]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
              <Store className="w-5 h-5" />
              <span className="font-medium text-sm">Mercado</span>
            </Link>
            <Link href="/dashboard/affiliations" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive('/dashboard/affiliations') ? 'bg-[#00e88a]/10 text-[#00e88a]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
              <Link2 className="w-5 h-5" />
              <span className="font-medium text-sm">Minhas Afiliações</span>
            </Link>
            <Link href="/dashboard/sales" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive('/dashboard/sales') ? 'bg-[#00e88a]/10 text-[#00e88a]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
              <DollarSign className="w-5 h-5" />
              <span className="font-medium text-sm">Minhas Comissões</span>
            </Link>
          </>
        )}

        {isProducer && (
          <>
            <div className="pt-4 pb-2">
              <span className="px-3 text-xs font-semibold text-white/30 uppercase tracking-wider">Produtor</span>
            </div>
            <Link href="/dashboard/products" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive('/dashboard/products') ? 'bg-[#00e88a]/10 text-[#00e88a]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
              <Box className="w-5 h-5" />
              <span className="font-medium text-sm">Meus Produtos</span>
            </Link>
            <Link href="/dashboard/sales" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive('/dashboard/sales') ? 'bg-[#00e88a]/10 text-[#00e88a]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
              <DollarSign className="w-5 h-5" />
              <span className="font-medium text-sm">Vendas</span>
            </Link>
            <Link href="/dashboard/webhooks" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive('/dashboard/webhooks') ? 'bg-[#00e88a]/10 text-[#00e88a]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
              <Webhook className="w-5 h-5" />
              <span className="font-medium text-sm">Webhooks</span>
            </Link>
            <Link href="/developers/webhooks" target="_blank" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ml-2 ${isActive('/developers/webhooks') ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}>
              <BookOpen className="w-4 h-4 ml-1" />
              <span className="font-medium text-sm">Guia de Integração</span>
            </Link>
          </>
        )}

        <div className="pt-4 pb-2">
          <span className="px-3 text-xs font-semibold text-white/30 uppercase tracking-wider">Configurações</span>
        </div>
        <Link href="/dashboard/pixels" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive('/dashboard/pixels') ? 'bg-[#00e88a]/10 text-[#00e88a]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
          <ScanLine className="w-5 h-5" />
          <span className="font-medium text-sm">Pixels</span>
        </Link>
        <Link href="/dashboard/settings/payments" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive('/dashboard/settings') ? 'bg-[#00e88a]/10 text-[#00e88a]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
          <CreditCard className="w-5 h-5" />
          <span className="font-medium text-sm">Pagamentos</span>
        </Link>
        <Link href="/dashboard/settings/profile" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive('/dashboard/settings/profile') ? 'bg-[#00e88a]/10 text-[#00e88a]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
          <Settings className="w-5 h-5" />
          <span className="font-medium text-sm">Conta</span>
        </Link>
      </nav>

      <div className="p-4 border-t border-white/10">
         <form action={signOutAction}>
            <button type="submit" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:bg-red-500/10 hover:text-red-400 transition-colors">
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">Sair da Conta</span>
            </button>
         </form>
      </div>
    </aside>
  )
}

