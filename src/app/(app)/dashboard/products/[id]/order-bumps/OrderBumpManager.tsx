'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X, GripVertical, ImageIcon, FileIcon } from 'lucide-react'
import { FileUpload } from '@/components/FileUpload'

type OrderBump = {
  id: string
  title: string
  description: string
  image_url: string
  price: number
  original_price: number
  file_paths: string[]
  plan_ids: string[]
  sort_order: number
}

type Plan = {
  id: string
  name: string
  price: number
  billing_type: string
}

type Props = {
  bumps: OrderBump[]
  plans: Plan[]
  productId: string
  userId: string
  createOrderBump: (productId: string, data: {
    title: string
    description?: string
    image_url?: string
    price: number
    original_price?: number
    file_paths?: string[]
    plan_ids?: string[]
  }) => Promise<void>
  updateOrderBump: (id: string, productId: string, data: {
    title: string
    description?: string
    image_url?: string
    price: number
    original_price?: number
    file_paths?: string[]
    plan_ids?: string[]
  }) => Promise<void>
  deleteOrderBump: (id: string, productId: string) => Promise<void>
}

const fieldClass = 'h-12 w-full rounded-xl border-0 bg-[#f4f4f6] px-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-orange-500/20'
const labelClass = 'mb-2 block text-sm font-medium text-slate-700'

export function OrderBumpManager({ bumps, plans, productId, userId, createOrderBump, updateOrderBump, deleteOrderBump }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<OrderBump | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [price, setPrice] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [filePath, setFilePath] = useState('')
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openNew() {
    setEditing(null)
    setTitle('')
    setDescription('')
    setImageUrl('')
    setPrice('')
    setOriginalPrice('')
    setFilePath('')
    setSelectedPlanIds([])
    setError(null)
    setShowForm(true)
  }

  function openEdit(bump: OrderBump) {
    setEditing(bump)
    setTitle(bump.title)
    setDescription(bump.description)
    setImageUrl(bump.image_url)
    setPrice(String(bump.price))
    setOriginalPrice(bump.original_price > 0 ? String(bump.original_price) : '')
    setFilePath(bump.file_paths?.[0] || '')
    setSelectedPlanIds(bump.plan_ids || [])
    setError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  async function handleSave() {
    if (!title.trim() || !price || Number(price) <= 0) {
      setError('Preencha título e preço válidos.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
        image_url: imageUrl,
        price: Number(price),
        original_price: originalPrice ? Number(originalPrice) : 0,
        file_paths: filePath ? [filePath] : [],
        plan_ids: selectedPlanIds,
      }
      if (editing) {
        await updateOrderBump(editing.id, productId, data)
      } else {
        await createOrderBump(productId, data)
      }
      closeForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(bump: OrderBump) {
    if (!confirm(`Remover "${bump.title}"?`)) return
    try {
      await deleteOrderBump(bump.id, productId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover')
    }
  }

  return (
    <div className="mt-10 max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Ofertas adicionais (Order Bumps)</h3>
          <p className="mt-1 text-sm text-slate-400">Gerencie as ofertas extras exibidas no checkout.</p>
        </div>
        <button onClick={openNew} className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600">
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </div>

      {bumps.length === 0 && !showForm && (
        <div className="rounded-2xl border border-slate-200 bg-[#fafafa] px-8 py-12 text-center">
          <p className="text-sm text-slate-400">Nenhum order bump cadastrado. Clique em &quot;Adicionar&quot; para criar o primeiro.</p>
        </div>
      )}

      <div className="space-y-4">
        {bumps.map((bump) => (
          <div key={bump.id} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mt-1 text-slate-300">
              <GripVertical className="h-5 w-5" />
            </div>
            {bump.image_url ? (
              <img src={bump.image_url} alt="" className="h-20 w-20 flex-shrink-0 rounded-xl object-cover ring-1 ring-slate-200" />
            ) : (
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-[#f4f4f6] text-slate-300 ring-1 ring-slate-200">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{bump.title}</h4>
                  {bump.description && (
                    <p className="mt-1 text-sm text-slate-500 line-clamp-2">{bump.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(bump)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(bump)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-sm font-bold text-slate-900">
                  R$ {Number(bump.price).toFixed(2)}
                </span>
                {bump.original_price > 0 && bump.original_price > bump.price && (
                  <span className="text-sm text-slate-400 line-through">
                    R$ {Number(bump.original_price).toFixed(2)}
                  </span>
                )}
                {bump.original_price > 0 && bump.original_price > bump.price && (
                  <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-600">
                    -{Math.round((1 - bump.price / bump.original_price) * 100)}%
                  </span>
                )}
              </div>
              {bump.plan_ids && bump.plan_ids.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {bump.plan_ids.map(planId => {
                    const plan = plans.find(p => p.id === planId)
                    return plan ? (
                      <span key={planId} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                        {plan.name}
                      </span>
                    ) : null
                  })}
                </div>
              )}
              {(!bump.plan_ids || bump.plan_ids.length === 0) && (
                <p className="mt-2 text-xs text-slate-400">Todos os planos</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editing ? 'Editar Order Bump' : 'Novo Order Bump'}
              </h3>
              <button onClick={closeForm} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-6 py-5">
              <div className="flex gap-4">
                <div className="w-24 shrink-0">
                  <span className={labelClass}>Capa</span>
                  {imageUrl ? (
                    <div className="relative mt-1">
                      <img src={imageUrl} alt="" className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />
                      <button onClick={() => setImageUrl('')} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <FileUpload mode="image" label="" userId={userId} folder="order-bumps" currentUrl="" onUpload={(url) => setImageUrl(Array.isArray(url) ? url[0] : url)} />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <label className="block">
                    <span className={labelClass}>Titulo *</span>
                    <input className={fieldClass} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Planilha de organizacao" />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className={labelClass}>Preco *</span>
                      <input className={fieldClass} type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="9.90" />
                    </label>
                    <label className="block">
                      <span className={labelClass}>De (riscado)</span>
                      <input className={fieldClass} type="number" min="0" step="0.01" value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} placeholder="19.90" />
                    </label>
                  </div>
                </div>
              </div>

              <label className="block">
                <span className={labelClass}>Descricao</span>
                <textarea className="min-h-16 w-full resize-none rounded-xl border-0 bg-[#f4f4f6] px-4 py-3 text-sm font-medium leading-5 text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-orange-500/20" value={description} onChange={e => setDescription(e.target.value)} placeholder="O que esta sendo oferecido?" />
              </label>

              <div className="block">
                <span className={labelClass}>Arquivo de entrega (opcional)</span>
                {filePath ? (
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <FileIcon className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{filePath.split('/').pop()}</span>
                    <button onClick={() => setFilePath('')} className="shrink-0 text-xs font-semibold text-red-500 hover:text-red-700">Remover</button>
                  </div>
                ) : (
                  <FileUpload mode="file" label="" userId={userId} folder="order-bump-files" currentUrl="" onUpload={(url) => setFilePath(Array.isArray(url) ? url[0] : url)} />
                )}
              </div>

              {plans.length > 0 && (
                <div className="block">
                  <span className={labelClass}>Planos vinculados</span>
                  <p className="mb-2 text-xs text-slate-400">Nenhum = aparece em todos</p>
                  <div className="flex flex-wrap gap-2">
                    {plans.map(plan => (
                      <label key={plan.id} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition cursor-pointer ${selectedPlanIds.includes(plan.id) ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                        <input
                          type="checkbox"
                          checked={selectedPlanIds.includes(plan.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPlanIds(prev => [...prev, plan.id])
                            } else {
                              setSelectedPlanIds(prev => prev.filter(id => id !== plan.id))
                            }
                          }}
                          className="accent-orange-500"
                        />
                        {plan.name} — R$ {Number(plan.price).toFixed(2)}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-100">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button onClick={closeForm} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-60">
                {saving ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
