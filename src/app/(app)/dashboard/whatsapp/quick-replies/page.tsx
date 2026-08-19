'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Zap, X, Save } from 'lucide-react'

interface QuickReply {
  id: string
  user_id: string
  shortcut: string
  message: string
  media_url?: string
  is_global: boolean
  created_at: string
}

export default function QuickRepliesPage() {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editingReply, setEditingReply] = useState<Partial<QuickReply>>({})

  const fetchQuickReplies = useCallback(async () => {
    try {
      const response = await fetch('/api/wa/quick-replies')
      const data = await response.json()
      if (data.quick_replies) {
        setQuickReplies(data.quick_replies)
      }
    } catch (error) {
      console.error('Error fetching quick replies:', error)
    }
  }, [])

  useEffect(() => {
    fetchQuickReplies()
  }, [fetchQuickReplies])

  const handleCreate = () => {
    setEditingReply({ shortcut: '', message: '', is_global: false })
    setIsEditing(true)
  }

  const handleEdit = (reply: QuickReply) => {
    setEditingReply(reply)
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!editingReply.shortcut || !editingReply.message) return

    try {
      const isUpdate = !!editingReply.id
      const url = isUpdate ? '/api/wa/quick-replies' : '/api/wa/quick-replies'
      const method = isUpdate ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingReply),
      })

      if (response.ok) {
        setIsEditing(false)
        setEditingReply({})
        fetchQuickReplies()
      }
    } catch (error) {
      console.error('Error saving quick reply:', error)
    }
  }

  const handleDelete = async (reply: QuickReply) => {
    if (!confirm(`Deletar resposta rápida "${reply.shortcut}"?`)) return

    try {
      await fetch(`/api/wa/quick-replies?id=${reply.id}`, { method: 'DELETE' })
      fetchQuickReplies()
    } catch (error) {
      console.error('Error deleting quick reply:', error)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Respostas Rápidas</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Crie atalhos para responder rapidamente
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Resposta
        </button>
      </div>

      {isEditing && (
        <div className="mb-6 p-4 bg-zinc-800/50 border border-zinc-800 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-300">
              {editingReply.id ? 'Editar Resposta' : 'Nova Resposta'}
            </h3>
            <button
              onClick={() => {
                setIsEditing(false)
                setEditingReply({})
              }}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Atalho *</label>
              <input
                type="text"
                value={editingReply.shortcut || ''}
                onChange={(e) => setEditingReply({ ...editingReply, shortcut: e.target.value })}
                placeholder="/obrigado"
                className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Mensagem *</label>
              <textarea
                value={editingReply.message || ''}
                onChange={(e) => setEditingReply({ ...editingReply, message: e.target.value })}
                placeholder="Olá! Obrigado pelo contato..."
                rows={4}
                className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_global"
                checked={editingReply.is_global || false}
                onChange={(e) => setEditingReply({ ...editingReply, is_global: e.target.checked })}
                className="rounded border-zinc-600 bg-zinc-700 text-emerald-500 focus:ring-emerald-500/50"
              />
              <label htmlFor="is_global" className="text-sm text-zinc-400">
                Global (disponível para todas as sessões)
              </label>
            </div>

            <button
              onClick={handleSave}
              disabled={!editingReply.shortcut || !editingReply.message}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {quickReplies.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhuma resposta rápida criada</p>
            <p className="text-xs mt-1">Crie atalhos para responder mais rápido</p>
          </div>
        ) : (
          quickReplies.map((reply) => (
            <div
              key={reply.id}
              className="flex items-start gap-3 p-4 bg-zinc-800/50 border border-zinc-800 rounded-lg"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-emerald-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                    {reply.shortcut}
                  </code>
                  {reply.is_global && (
                    <span className="text-xs text-zinc-500 bg-zinc-700 px-2 py-0.5 rounded">
                      Global
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{reply.message}</p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(reply)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(reply)}
                  className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
