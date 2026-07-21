'use client'

import { useState } from 'react'
import { ExternalLink, Package, Pencil, Save, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { updatePlanAction } from './actions'

interface Plan {
  id: string
  name: string
  price: number
  plan_identifier: string | null
  billing_type?: string | null
}

const inputClass = 'w-full rounded-lg border-0 bg-card px-3 py-2 text-sm text-foreground outline-none ring-1 ring-border focus:ring-2 focus:ring-orange-500/20'

export function EditablePlanCard({ plan, productId }: { plan: Plan; productId: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: plan.name,
    price: plan.price.toString(),
    plan_identifier: plan.plan_identifier || '',
    billing_type: plan.billing_type === 'recurring' ? 'recurring' : 'one_time',
  })
  const router = useRouter()

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const form = new FormData()
    form.append('name', formData.name)
    form.append('price', formData.price)
    form.append('plan_identifier', formData.plan_identifier)
    form.append('billing_type', formData.billing_type)

    try {
      const res = await updatePlanAction(productId, plan.id, form)
      if (res.success) {
        setIsEditing(false)
        router.refresh()
      } else {
        alert('Erro ao atualizar plano: ' + res.error)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro inesperado de rede.'
      alert('Erro de rede: ' + message)
    } finally {
      setLoading(false)
    }
  }

  if (isEditing) {
    return (
      <div className="border-b border-orange-100 bg-orange-50/40 p-5">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <EditField label="Nome do plano">
              <input className={inputClass} type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </EditField>
            <EditField label="Preco">
              <input className={inputClass} type="number" min="5" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required />
            </EditField>
            <EditField label="Tipo">
              <select className={inputClass} value={formData.billing_type} onChange={e => setFormData({ ...formData, billing_type: e.target.value })}>
                <option value="one_time">Preco unico</option>
                <option value="recurring">Recorrente mensal</option>
              </select>
            </EditField>
            <EditField label="Identificador externo">
              <input className={inputClass} type="text" value={formData.plan_identifier} onChange={e => setFormData({ ...formData, plan_identifier: e.target.value })} placeholder="Opcional" />
            </EditField>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-muted transition hover:text-foreground">
              <X className="h-3.5 w-3.5" />
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-1.5 text-xs font-bold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-50">
              <Save className="h-3.5 w-3.5" />
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="group flex flex-col justify-between gap-4 p-5 transition hover:bg-surface md:flex-row md:items-center">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface ring-1 ring-border transition group-hover:bg-orange-50 group-hover:ring-orange-100">
          <Package className="h-5 w-5 text-muted transition group-hover:text-orange-600" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">{plan.name}</h3>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="font-mono text-xs text-muted">ID: {plan.id.slice(0, 12)}...</p>
            {plan.plan_identifier && (
              <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                {plan.plan_identifier}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-4 md:w-auto md:justify-end md:gap-6">
        <div className="text-left md:text-right">
          <span className="text-xl font-extrabold text-foreground">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.price)}
          </span>
          <span className="ml-1 text-xs font-medium text-muted">{plan.billing_type === 'recurring' ? '/mes' : 'unico'}</span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setIsEditing(true)} className="rounded-lg p-2.5 text-muted transition hover:bg-orange-50 hover:text-orange-600" title="Editar plano">
            <Pencil className="h-4 w-4" />
          </button>
          <a href={`/checkout/${plan.id}`} target="_blank" className="rounded-lg p-2.5 text-muted transition hover:bg-orange-50 hover:text-orange-600" title="Ver checkout">
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  )
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}
