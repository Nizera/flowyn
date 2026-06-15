'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X, GripVertical, ImageIcon } from 'lucide-react'
import { FileUpload } from '@/components/FileUpload'

type OrderBump = {
  id: string
  title: string
  description: string
  image_url: string
  price: number
  original_price: number
  sort_order: number
}

type Props = {
  bumps: OrderBump[]
  productId: string
  userId: string
  createOrderBump: (productId: string, data: {
    title: string
    description?: string
    image_url?: string
    price: number
    original_price?: number
  }) => Promise<void>
  updateOrderBump: (id: string, productId: string, data: {
    title: string
    description?: string
    image_url?: string
    price: number
    original_price?: number
  }) => Promise<void>
  deleteOrderBump: (id: string, productId: string) => Promise<void>
}

const fieldClass = 'h-12 w-full rounded-xl border-0 bg-[#f4f4f6] px-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-orange-500/20'
const labelClass = 'mb-2 block text-sm font-medium text-slate-700'

export function OrderBumpManager({ bumps, productId, userId, createOrderBump, updateOrderBump, deleteOrderBump }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<OrderBump | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [price, setPrice] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openNew() {
    setEditing(null)
    setTitle('')
    setDescription('')
    setImageUrl('')
    setPrice('')
    setOriginalPrice('')
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
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {editing ? 'Editar Order Bump' : 'Novo Order Bump'}
              </h3>
              <button onClick={closeForm} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className={labelClass}>Imagem de capa</span>
                <FileUpload
                  mode="image"
                  label=""
                  userId={userId}
                  folder="order-bumps"
                  currentUrl={imageUrl}
                  onUpload={(url) => setImageUrl(Array.isArray(url) ? url[0] : url)}
                  onRemove={() => setImageUrl('')}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Titulo *</span>
                <input className={fieldClass} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Planilha de organização" />
              </label>

              <label className="block">
                <span className={labelClass}>Descricao</span>
                <textarea className="min-h-20 w-full resize-none rounded-xl border-0 bg-[#f4f4f6] px-4 py-3 text-sm font-medium leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-orange-500/20" value={description} onChange={e => setDescription(e.target.value)} placeholder="O que está sendo oferecido?" />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={labelClass}>Preco *</span>
                  <input className={fieldClass} type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="9.90" />
                </label>
                <label className="block">
                  <span className={labelClass}>Preco original (riscado)</span>
                  <input className={fieldClass} type="number" min="0" step="0.01" value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} placeholder="19.90" />
                </label>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-100">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeForm} className="rounded-xl px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-60">
                  {saving ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
