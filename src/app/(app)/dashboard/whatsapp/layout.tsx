'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MessageSquare,
  Settings,
  Users,
  Phone,
  Hash,
  Zap,
  Bot,
  Puzzle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    label: 'Chat',
    href: '/dashboard/whatsapp/chats',
    icon: MessageSquare,
  },
  {
    label: 'Conexões',
    href: '/dashboard/whatsapp/connections',
    icon: Phone,
  },
  {
    label: 'Contatos',
    href: '/dashboard/whatsapp/contacts',
    icon: Users,
  },
  {
    label: 'Filas',
    href: '/dashboard/whatsapp/queues',
    icon: Hash,
  },
  {
    label: 'Agente IA',
    href: '/dashboard/whatsapp/agent',
    icon: Bot,
  },
  {
    label: 'Skills',
    href: '/dashboard/whatsapp/skills',
    icon: Puzzle,
  },
  {
    label: 'Respostas Rápidas',
    href: '/dashboard/whatsapp/quick-replies',
    icon: Zap,
  },
]

export default function WhatsAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <aside
        className={cn(
          'w-56 border-r border-zinc-800 bg-zinc-900/50 flex-shrink-0 transition-all duration-200',
          !sidebarOpen && 'w-16'
        )}
      >
        <nav className="p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-600/20 text-emerald-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
