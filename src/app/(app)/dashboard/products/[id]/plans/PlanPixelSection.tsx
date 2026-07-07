'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronUp, Loader2, Plus, ScanLine, X } from 'lucide-react'
import { addPlanPixel, removePlanPixel } from '../../../pixels/actions'

const PLATFORM_BADGES: Record<string, { label: string; icon: string; color: string }> = {
  meta: { label: 'Meta Ads', icon: '/meta.png', color: 'bg-orange-50 border-orange-100 text-orange-600' },
  google: { label: 'Google Ads', icon: '/google.png', color: 'bg-red-50 border-red-100 text-red-700' },
  tiktok: { label: 'TikTok', icon: '/tiktok.png', color: 'bg-slate-50 border-slate-200 text-slate-600' },
}

interface Pixel { id: string; name: string; platform: string; pixel_id: string }
interface PlanPixelRow { id: string; pixel: Pixel }

interface Props {
  planId: string
  planPixels: PlanPixelRow[]
  availablePixels: Pixel[]
}

export function PlanPixelSection({ planId, planPixels, availablePixels }: Props) {
  const [open, setOpen] = useState(false)
  const [showSelect, setShowSelect] = useState(false)
  const [isPending, startTransition] = useTransition()

  const linkedIds = new Set(planPixels.map(pp => pp.pixel.id))
  const unlinked = availablePixels.filter(p => !linkedIds.has(p.id))

  function handleAdd(pixelId: string) {
    startTransition(async () => {
      await addPlanPixel(planId, pixelId)
      setShowSelect(false)
    })
  }

  function handleRemove(planPixelId: string) {
    void removePlanPixel(planPixelId)
  }

  return (
    <div className="mt-0 border-t border-slate-100">
      <button
        onClick={() => setOpen(v => !v)}
        className="group flex w-full items-center justify-between px-5 py-3 text-xs text-slate-400 transition hover:text-slate-600"
      >
        <span className="flex items-center gap-2">
          <ScanLine className="h-3.5 w-3.5" />
          <span className="font-semibold uppercase tracking-wider">Pixels deste plano</span>
          {planPixels.length > 0 && (
            <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">
              {planPixels.length}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="space-y-3 px-5 pb-5">
          {planPixels.length === 0 ? (
            <p className="text-xs italic text-slate-400">Nenhum pixel vinculado. Adicione um para rastrear conversoes deste plano.</p>
          ) : (
            <div className="space-y-2">
              {planPixels.map(pp => {
                const badge = PLATFORM_BADGES[pp.pixel.platform] ?? PLATFORM_BADGES.meta
                return (
                  <div key={pp.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${badge.color}`}>
                        <img src={badge.icon} alt={badge.label} className="h-3.5 w-3.5 object-contain" />
                        {badge.label}
                      </span>
                      <span className="text-sm font-medium text-slate-800">{pp.pixel.name}</span>
                      <span className="font-mono text-xs text-slate-400">{pp.pixel.pixel_id}</span>
                    </div>
                    <button onClick={() => handleRemove(pp.id)} disabled={isPending} className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {!showSelect ? (
            <button onClick={() => setShowSelect(true)} disabled={unlinked.length === 0} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 transition hover:text-orange-800 disabled:cursor-not-allowed disabled:opacity-30">
              <Plus className="h-3.5 w-3.5" />
              {unlinked.length === 0 ? 'Nenhum pixel disponivel - cadastre em Configuracoes > Pixels' : 'Adicionar pixel'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <select
                onChange={e => { if (e.target.value) handleAdd(e.target.value) }}
                defaultValue=""
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-300"
              >
                <option value="" disabled>Selecionar pixel...</option>
                {unlinked.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.platform.toUpperCase()})
                  </option>
                ))}
              </select>
              {isPending && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}
              <button onClick={() => setShowSelect(false)} className="text-slate-400 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
