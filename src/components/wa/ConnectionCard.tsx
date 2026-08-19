'use client'

import {
  Wifi,
  WifiOff,
  Smartphone,
  Settings,
  Trash2,
  QrCode,
  LogOut,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Session {
  id: string
  name: string
  phone_number?: string
  status: string
  color: string
  is_default: boolean
  allow_groups: boolean
  created_at: string
}

interface ConnectionCardProps {
  session: Session
  onPair?: () => void
  onLogout?: () => void
  onDelete?: () => void
  onSettings?: () => void
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  connected: {
    icon: <CheckCircle2 className="w-5 h-5" />,
    label: 'Conectado',
    color: 'text-emerald-400 bg-emerald-400/10',
  },
  disconnected: {
    icon: <XCircle className="w-5 h-5" />,
    label: 'Desconectado',
    color: 'text-zinc-400 bg-zinc-400/10',
  },
  qr_pending: {
    icon: <Loader2 className="w-5 h-5 animate-spin" />,
    label: 'Aguardando QR',
    color: 'text-amber-400 bg-amber-400/10',
  },
  connecting: {
    icon: <Loader2 className="w-5 h-5 animate-spin" />,
    label: 'Conectando...',
    color: 'text-blue-400 bg-blue-400/10',
  },
}

export function ConnectionCard({
  session,
  onPair,
  onLogout,
  onDelete,
  onSettings,
}: ConnectionCardProps) {
  const status = statusConfig[session.status] || statusConfig.disconnected
  const isConnected = session.status === 'connected'

  return (
    <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: session.color + '20' }}
          >
            <Smartphone className="w-6 h-6" style={{ color: session.color }} />
          </div>
          <div>
            <h3 className="font-medium text-zinc-100">{session.name}</h3>
            {session.phone_number && (
              <p className="text-sm text-zinc-400">{session.phone_number}</p>
            )}
          </div>
        </div>

        <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium', status.color)}>
          {status.icon}
          {status.label}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {session.is_default && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
            Padrão
          </span>
        )}
        {session.allow_groups && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
            Grupos
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Desconectar
            </button>
            <button
              onClick={onSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              Configurar
            </button>
          </>
        ) : (
          <button
            onClick={onPair}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
          >
            <QrCode className="w-4 h-4" />
            Conectar
          </button>
        )}

        <button
          onClick={onDelete}
          className="ml-auto p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
