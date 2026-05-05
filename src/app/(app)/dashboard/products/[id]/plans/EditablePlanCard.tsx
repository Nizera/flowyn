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
      <div className="bg-[#111111] border-0 rounded-none p-5 border-b border-[#00e88a]/30 transition-all animate-in fade-in zoom-in duration-200">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-[10px] uppercase font-bold text-white/40 mb-1">Nome do Plano</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-2 px-3 text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-white/40 mb-1">Preço (R$)</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-2 px-3 text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-white/40 mb-1">Identificador SaaS</label>
              <input
                type="text"
                value={formData.plan_identifier}
                onChange={(e) => setFormData({ ...formData, plan_identifier: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-2 px-3 text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] outline-none"
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-white/50 hover:text-white font-bold text-xs transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 bg-[#00e88a] hover:bg-[#00e88a]/90 text-black px-4 py-1.5 rounded-lg font-bold text-xs shadow-[0_0_15px_rgba(0,232,138,0.3)] transition-colors disabled:opacity-50"
            >
              {loading ? <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-[#00e88a]/10 group-hover:border-[#00e88a]/20 transition-colors">
          <Package className="w-5 h-5 text-white/60 group-hover:text-[#00e88a] transition-colors" />
        </div>
        <div>
          <h3 className="font-bold text-white">{plan.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-white/40 font-mono">ID: {plan.id.slice(0, 12)}...</p>
            {plan.plan_identifier && (
              <span className="bg-white/5 text-white/50 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border border-white/10">
                {plan.plan_identifier}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 md:gap-6">
        <div className="text-left md:text-right">
          <span className="text-xl font-extrabold text-white">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.price)}
          </span>
          <span className="text-xs text-white/40 font-medium ml-1">/mês</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="p-2.5 text-white/40 hover:text-[#00e88a] hover:bg-[#00e88a]/10 rounded-lg transition-all"
            title="Editar plano"
          >
            <Pencil className="w-4 h-4" />
          </button>
          
          <a
            href={`/checkout/${plan.id}`}
            target="_blank"
            className="p-2.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            title="Ver checkout"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  )
}
