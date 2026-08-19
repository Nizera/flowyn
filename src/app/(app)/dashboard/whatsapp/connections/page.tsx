'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { ConnectionCard } from '@/components/wa/ConnectionCard'
import { QRCodeDisplay } from '@/components/wa/QRCodeDisplay'

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

export default function ConnectionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [qrStatus, setQrStatus] = useState<'idle' | 'loading' | 'qr_ready' | 'paired' | 'error'>('idle')
  const [qrData, setQrData] = useState<string | undefined>()
  const [qrError, setQrError] = useState<string | undefined>()
  const [showQRModal, setShowQRModal] = useState(false)

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/wa/sessions')
      const data = await response.json()
      if (data.sessions) {
        setSessions(data.sessions)
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return

    try {
      const response = await fetch('/api/wa/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSessionName.trim() }),
      })

      if (response.ok) {
        setNewSessionName('')
        setIsCreating(false)
        fetchSessions()
      }
    } catch (error) {
      console.error('Error creating session:', error)
    }
  }

  const handlePair = async (session: Session) => {
    setSelectedSession(session)
    setShowQRModal(true)
    setQrStatus('loading')

    try {
      const response = await fetch(`/api/wa/sessions/${session.id}/pair`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        setQrData(data.qr)
        setQrStatus('qr_ready')
      } else {
        const error = await response.json()
        setQrError(error.error || 'Erro ao gerar QR Code')
        setQrStatus('error')
      }
    } catch (error) {
      setQrError('Erro de conexão')
      setQrStatus('error')
    }
  }

  const handleRefreshQR = async () => {
    if (!selectedSession) return
    setQrStatus('loading')
    try {
      const response = await fetch(`/api/wa/sessions/${selectedSession.id}/pair`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setQrData(data.qr)
        setQrStatus('qr_ready')
      }
    } catch (error) {
      setQrStatus('error')
    }
  }

  const handleLogout = async (session: Session) => {
    if (!confirm(`Desconectar ${session.name}?`)) return

    try {
      await fetch(`/api/wa/sessions/${session.id}/logout`, { method: 'POST' })
      fetchSessions()
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const handleDelete = async (session: Session) => {
    if (!confirm(`Deletar ${session.name}? Esta ação não pode ser desfeita.`)) return

    try {
      await fetch(`/api/wa/sessions/${session.id}`, { method: 'DELETE' })
      fetchSessions()
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Conexões WhatsApp</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Gerencie suas conexões com o WhatsApp
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Conexão
        </button>
      </div>

      {isCreating && (
        <div className="mb-6 p-4 bg-zinc-800/50 border border-zinc-800 rounded-xl">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Nova Conexão</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="Nome da conexão"
              className="flex-1 px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              autoFocus
            />
            <button
              onClick={handleCreateSession}
              disabled={!newSessionName.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              Criar
            </button>
            <button
              onClick={() => {
                setIsCreating(false)
                setNewSessionName('')
              }}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhuma conexão criada</p>
            <p className="text-xs mt-1">Crie uma nova conexão para começar</p>
          </div>
        ) : (
          sessions.map((session) => (
            <ConnectionCard
              key={session.id}
              session={session}
              onPair={() => handlePair(session)}
              onLogout={() => handleLogout(session)}
              onDelete={() => handleDelete(session)}
            />
          ))
        )}
      </div>

      {showQRModal && selectedSession && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-zinc-100">
                Conectar: {selectedSession.name}
              </h3>
              <button
                onClick={() => {
                  setShowQRModal(false)
                  setSelectedSession(null)
                  setQrStatus('idle')
                }}
                className="text-zinc-400 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <QRCodeDisplay
              sessionId={selectedSession.id}
              onPair={() => handlePair(selectedSession)}
              onRefresh={handleRefreshQR}
              status={qrStatus}
              qrData={qrData}
              error={qrError}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Phone(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}
