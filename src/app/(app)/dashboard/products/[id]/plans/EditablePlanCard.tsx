'use client'

import { useState } from 'react'
import { Package, ExternalLink, Pencil, Save, X, Trash2 } from 'lucide-react'
import { updatePlanAction } from './actions'
import { useRouter } from 'next/navigation'

interface Plan {
  id: string
  name: string
  price: number
  plan_identifier: string | null
}

export function EditablePlanCard({ plan, productId }: { plan: Plan, productId: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: plan.name,
    price: plan.price.toString(),
    plan_identifier: plan.plan_identifier || ''
  })
  const router = useRouter()

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    const form = new FormData()
    form.append('name', formData.name)
    form.append('price', formData.price)
    form.append('plan_identifier', formData.plan_identifier)

    try {
      const res = await updatePlanAction(productId, plan.id, form)
      if (res.success) {
        setIsEditing(false)
        router.refresh()
      } else {
        alert('Erro ao atualizar plano: ' + res.error)
      }
    } catch (err: any) {
      alert('Erro de rede: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (isEditing) {
    return (
      <div className="bg-slate-50 border-2 border-indigo-500 rounded-2xl p-5 shadow-inner transition-all animate-in fade-in zoom-in duration-200">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Nome do Plano</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Preço (R$)</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
                className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Identificador SaaS</label>
              <input
                type="text"
                value={formData.plan_identifier}
                onChange={(e) => setFormData({ ...formData, plan_identifier: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-slate-700 font-bold text-xs"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 group">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-200">
          <Package className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">{plan.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-400 font-mono">ID: {plan.id.slice(0, 12)}...</p>
            {plan.plan_identifier && (
              <span className="bg-slate-100 text-slate-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border border-slate-200">
                {plan.plan_identifier}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        <div className="text-right">
          <span className="text-xl font-extrabold text-slate-900">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.price)}
          </span>
          <span className="text-xs text-slate-400 font-medium ml-1">/mês</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            title="Editar plano"
          >
            <Pencil className="w-4 h-4" />
          </button>
          
          <a
            href={`/checkout/${plan.id}`}
            target="_blank"
            className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
            title="Ver checkout"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  )
}
