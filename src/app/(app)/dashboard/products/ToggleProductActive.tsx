'use client'

import { useState } from 'react'
import { Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import { toggleProductActive } from './actions'

export function ToggleProductActive({
  productId,
  isActive,
  atLimit,
}: {
  productId: string
  isActive: boolean
  atLimit: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(isActive)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    if (loading) return
    if (!active && atLimit) {
      setError('Limite do plano atingido. Assine o plano Pro.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await toggleProductActive(productId)
      if (result.success) {
        setActive(!active)
      } else {
        setError(result.error || 'Erro ao alterar status')
      }
    } catch {
      setError('Erro ao alterar status')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className="inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
        ) : active ? (
          <ToggleRight className="h-4 w-4 text-emerald-500" />
        ) : (
          <ToggleLeft className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
        )}
        <span className={`text-[11px] font-medium ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {active ? 'Ativo' : 'Inativo'}
        </span>
      </button>
      {error && (
        <p className="mt-0.5 text-[10px] text-red-600">{error}</p>
      )}
    </div>
  )
}
