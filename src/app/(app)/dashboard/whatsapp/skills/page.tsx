'use client'

import { useState, useEffect, useCallback } from 'react'
import { Puzzle, Plus, Edit2, Trash2, Save, X, Zap, Lock, Unlock, Eye } from 'lucide-react'

interface Skill {
  id: string
  user_id: string | null
  name: string
  slug: string
  description: string | null
  is_system: boolean
  is_enabled: boolean
  trigger_type: string
  trigger_config: Record<string, unknown>
  action_type: string
  action_config: Record<string, unknown>
  priority: number
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Partial<Skill>>({})

  const fetchSkills = useCallback(async () => {
    try {
      const response = await fetch('/api/wa/skills')
      const data = await response.json()
      if (data.skills) {
        setSkills(data.skills)
      }
    } catch (error) {
      console.error('Error fetching skills:', error)
    }
  }, [])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  const handleCreate = () => {
    setEditingSkill({
      name: '',
      slug: '',
      description: '',
      trigger_type: 'keyword',
      trigger_config: { keywords: [] },
      action_type: 'message',
      action_config: { message: '' },
      priority: 0,
    })
    setIsEditing(true)
  }

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill)
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!editingSkill.name || !editingSkill.slug) return

    try {
      const isUpdate = !!editingSkill.id
      const method = isUpdate ? 'PUT' : 'POST'
      
      const response = await fetch('/api/wa/skills', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSkill),
      })

      if (response.ok) {
        setIsEditing(false)
        setEditingSkill({})
        fetchSkills()
      }
    } catch (error) {
      console.error('Error saving skill:', error)
    }
  }

  const handleDelete = async (skill: Skill) => {
    if (skill.is_system) return
    if (!confirm(`Deletar skill "${skill.name}"?`)) return

    try {
      await fetch(`/api/wa/skills?id=${skill.id}`, { method: 'DELETE' })
      fetchSkills()
    } catch (error) {
      console.error('Error deleting skill:', error)
    }
  }

  const triggerTypeLabels: Record<string, string> = {
    keyword: 'Palavra-chave',
    intent: 'Intenção',
    regex: 'Regex',
    manual: 'Manual',
  }

  const actionTypeLabels: Record<string, string> = {
    message: 'Mensagem',
    pix: 'Gerar PIX',
    checkout: 'Checkout',
    webhook: 'Webhook',
    transfer: 'Transferir',
    custom: 'Custom',
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Puzzle className="w-8 h-8 text-emerald-500" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Skills do Agente</h1>
            <p className="text-sm text-zinc-400">Configure as ações do agente IA</p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Skill
        </button>
      </div>

      {isEditing && (
        <div className="mb-6 p-4 bg-zinc-800/50 border border-zinc-800 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-300">
              {editingSkill.is_system ? 'Visualizar Skill' : editingSkill.id ? 'Editar Skill' : 'Nova Skill'}
            </h3>
            <button
              onClick={() => { setIsEditing(false); setEditingSkill({}) }}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Nome *</label>
                <input
                  type="text"
                  value={editingSkill.name || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                  placeholder="Minha Skill"
                  readOnly={!!editingSkill.is_system}
                  className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Slug *</label>
                <input
                  type="text"
                  value={editingSkill.slug || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, slug: e.target.value })}
                  placeholder="minha-skill"
                  readOnly={!!editingSkill.is_system}
                  className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
                <label className="text-xs text-zinc-400 mb-1 block">Descrição</label>
                <input
                  type="text"
                  value={editingSkill.description || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                  placeholder="O que esta skill faz"
                  readOnly={!!editingSkill.is_system}
                  className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Tipo de Trigger</label>
                <select
                  value={editingSkill.trigger_type || 'keyword'}
                  onChange={(e) => setEditingSkill({ ...editingSkill, trigger_type: e.target.value })}
                  disabled={!!editingSkill.is_system}
                  className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60"
                >
                  {Object.entries(triggerTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Tipo de Ação</label>
                <select
                  value={editingSkill.action_type || 'message'}
                  onChange={(e) => setEditingSkill({ ...editingSkill, action_type: e.target.value })}
                  disabled={!!editingSkill.is_system}
                  className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60"
                >
                  {Object.entries(actionTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                Config do Trigger (JSON)
              </label>
              <textarea
                value={JSON.stringify(editingSkill.trigger_config || {}, null, 2)}
                onChange={(e) => {
                  try {
                    setEditingSkill({ ...editingSkill, trigger_config: JSON.parse(e.target.value) })
                  } catch {}
                }}
                rows={3}
                readOnly={!!editingSkill.is_system}
                className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                Config da Ação (JSON)
              </label>
              <textarea
                value={JSON.stringify(editingSkill.action_config || {}, null, 2)}
                onChange={(e) => {
                  try {
                    setEditingSkill({ ...editingSkill, action_config: JSON.parse(e.target.value) })
                  } catch {}
                }}
                rows={3}
                readOnly={!!editingSkill.is_system}
                className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Prioridade</label>
              <input
                type="number"
                value={editingSkill.priority || 0}
                onChange={(e) => setEditingSkill({ ...editingSkill, priority: parseInt(e.target.value) })}
                className="w-32 px-3 py-2 bg-zinc-700 text-zinc-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            {!editingSkill.is_system && (
              <button
                onClick={handleSave}
                disabled={!editingSkill.name || !editingSkill.slug}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Salvar
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {skills.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <Puzzle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhuma skill configurada</p>
          </div>
        ) : (
          skills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-start gap-3 p-4 bg-zinc-800/50 border border-zinc-800 rounded-lg"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                skill.is_system ? 'bg-blue-500/20' : 'bg-emerald-500/20'
              }`}>
                {skill.is_system ? (
                  <Lock className="w-5 h-5 text-blue-400" />
                ) : (
                  <Zap className="w-5 h-5 text-emerald-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-zinc-100">{skill.name}</h4>
                  <code className="text-xs text-zinc-500 bg-zinc-700 px-1.5 py-0.5 rounded">
                    {skill.slug}
                  </code>
                  {skill.is_system && (
                    <span className="text-xs text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">
                      Sistema
                    </span>
                  )}
                </div>
                {skill.description && (
                  <p className="text-sm text-zinc-400 mt-1">{skill.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-zinc-500">
                    Trigger: {triggerTypeLabels[skill.trigger_type] || skill.trigger_type}
                  </span>
                  <span className="text-xs text-zinc-500">
                    Ação: {actionTypeLabels[skill.action_type] || skill.action_type}
                  </span>
                  <span className="text-xs text-zinc-500">
                    Prioridade: {skill.priority}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(skill)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
                  title={skill.is_system ? "Visualizar" : "Editar"}
                >
                  <Eye className="w-4 h-4" />
                </button>
                {!skill.is_system && (
                  <>
                    <button
                      onClick={() => handleEdit(skill)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(skill)}
                      className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
