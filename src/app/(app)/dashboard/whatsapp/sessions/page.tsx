'use client'

import { useEffect, useState } from 'react'
import { Plus, QrCode, Trash2, RefreshCw } from 'lucide-react'

interface Session {
  session_id: string
  status: string
  phone_number?: string
  qr_code?: string
  created_at: string
  last_active?: string
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSessionId, setNewSessionId] = useState('')
  const [newBusinessName, setNewBusinessName] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  const fetchSessions = () => {
    fetch('/api/whatsapp/worker/sessions')
      .then((r) => r.json())
      .then((data) => {
        setSessions(data.sessions || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleCreate = async () => {
    if (!newSessionId.trim()) return
    setCreating(true)

    try {
      const res = await fetch('/api/whatsapp/worker/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: newSessionId.trim(),
          businessName: newBusinessName.trim() || undefined,
        }),
      })

      if (res.ok) {
        setShowCreateModal(false)
        setNewSessionId('')
        setNewBusinessName('')
        fetchSessions()
      }
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta sessão?')) return

    await fetch(`/api/whatsapp/worker/sessions?sessionId=${sessionId}`, {
      method: 'DELETE',
    })
    fetchSessions()
  }

  const handleRefreshQr = async (sessionId: string) => {
    const res = await fetch(`/api/whatsapp/worker/sessions/qr?sessionId=${sessionId}`)
    const data = await res.json()
    if (data.qr) {
      setSelectedSession((prev) => prev?.session_id === sessionId ? { ...prev, qr_code: data.qr } : prev)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Sessões WhatsApp</h1>
          <p className="text-muted mt-2">Conecte e gerencie seus números do WhatsApp</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-white hover:bg-green-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Sessão
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted">Carregando...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <QrCode className="h-12 w-12 text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Nenhuma sessão criada</h3>
          <p className="text-muted mt-2">Crie sua primeira sessão para conectar um número do WhatsApp</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.session_id}
              className="rounded-xl bg-surface p-6 border border-border"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`h-4 w-4 rounded-full ${
                    session.status === 'connected' ? 'bg-green-500' :
                    session.status === 'qr_pending' ? 'bg-yellow-500 animate-pulse' :
                    session.status === 'disconnected' ? 'bg-red-500' : 'bg-gray-500'
                  }`} />
                  <div>
                    <h3 className="font-semibold text-lg">{session.session_id}</h3>
                    <p className="text-sm text-muted">
                      {session.phone_number || 'Aguardando QR Code'} • {session.status}
                    </p>
                    {session.last_active && (
                      <p className="text-xs text-muted mt-1">
                        Último acesso: {new Date(session.last_active).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session.status === 'qr_pending' && (
                    <button
                      onClick={() => handleRefreshQr(session.session_id)}
                      className="p-2 text-yellow-500 hover:bg-yellow-500/10 rounded-lg transition-colors"
                      title="Atualizar QR Code"
                    >
                      <RefreshCw className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(session.session_id)}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Deletar sessão"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {session.qr_code && session.status === 'qr_pending' && (
                <div className="mt-4 p-4 bg-white rounded-lg inline-block">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(session.qr_code)}`}
                    alt="QR Code"
                    className="w-48 h-48"
                  />
                  <p className="text-sm text-muted text-center mt-2">
                    Escaneie com o WhatsApp
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar Sessão */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md border border-border">
            <h2 className="text-xl font-bold mb-4">Nova Sessão WhatsApp</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">ID da Sessão</label>
                <input
                  type="text"
                  value={newSessionId}
                  onChange={(e) => setNewSessionId(e.target.value)}
                  placeholder="ex: meu-negocio-sp"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nome do Negócio (opcional)</label>
                <input
                  type="text"
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  placeholder="ex: Minha Loja"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!newSessionId.trim() || creating}
                className="flex-1 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-white hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {creating ? 'Criando...' : 'Criar Sessão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
