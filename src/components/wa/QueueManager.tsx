'use client'

import { useState } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  Users,
  X,
  Save,
  Hash,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Queue {
  id: string
  user_id: string
  name: string
  color: string
  distribution: string
  max_load: number
  greeting_message?: string
  out_of_hours_message?: string
  business_hours?: Record<string, unknown>
  created_at: string
}

interface QueueManagerProps {
  queues: Queue[]
  onCreateQueue: (data: { name: string; color: string; max_load: number }) => void
  onUpdateQueue: (id: string, data: Partial<Queue>) => void
  onDeleteQueue: (id: string) => void
}

export function QueueManager({
  queues,
  onCreateQueue,
  onUpdateQueue,
  onDeleteQueue,
}: QueueManagerProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    color: '#25D366',
    max_load: 10,
  })

  const handleCreate = () => {
    if (!formData.name.trim()) return
    onCreateQueue(formData)
    setFormData({ name: '', color: '#25D366', max_load: 10 })
    setIsCreating(false)
  }

  const handleUpdate = (id: string) => {
    if (!formData.name.trim()) return
    onUpdateQueue(id, formData)
    setEditingId(null)
    setFormData({ name: '', color: '#25D366', max_load: 10 })
  }

  const startEditing = (queue: Queue) => {
    setEditingId(queue.id)
    setFormData({
      name: queue.name,
      color: queue.color,
      max_load: queue.max_load,
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setIsCreating(false)
    setFormData({ name: '', color: '#25D366', max_load: 10 })
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-zinc-100">Filas de Atendimento</h3>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Fila
        </button>
      </div>

      {isCreating && (
        <div className="mb-4 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
          <h4 className="text-sm font-medium text-zinc-300 mb-3">Nova Fila</h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Nome *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Suporte Técnico"
                className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Cor</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <span className="text-xs text-zinc-500">{formData.color}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Máx. chats</label>
                <input
                  type="number"
                  value={formData.max_load}
                  onChange={(e) => setFormData({ ...formData, max_load: parseInt(e.target.value) || 10 })}
                  min={1}
                  max={100}
                  className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!formData.name.trim()}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Salvar
              </button>
              <button
                onClick={cancelEditing}
                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {queues.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <Hash className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma fila criada</p>
          </div>
        ) : (
          queues.map((queue) => (
            <div
              key={queue.id}
              className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-800"
            >
              <div
                className="w-3 h-8 rounded-full flex-shrink-0"
                style={{ backgroundColor: queue.color }}
              />

              {editingId === queue.id ? (
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-zinc-700 text-zinc-100 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(queue.id)}
                      className="px-2 py-1 bg-emerald-600 text-white text-xs rounded"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-2 py-1 bg-zinc-700 text-zinc-300 text-xs rounded"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-zinc-100 truncate">{queue.name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Máx: {queue.max_load}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {queue.distribution === 'round-robin' ? 'Auto' : 'Manual'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEditing(queue)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteQueue(queue.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
