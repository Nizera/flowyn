'use client'

import { useState, useTransition } from 'react'
import { ScanLine, Plus, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { addPlanPixel, removePlanPixel } from '../../../pixels/actions'

const PLATFORM_BADGES: Record<string, { label: string; icon: string; color: string }> = {
  meta:   { label: 'Meta Ads',   icon: '/meta.png',   color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
  google: { label: 'Google Ads', icon: '/google.png', color: 'bg-red-500/10 border-red-500/20 text-red-400' },
  tiktok: { label: 'TikTok',     icon: '/tiktok.png', color: 'bg-white/5 border-white/10 text-white/60' },
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
    startTransition(() => removePlanPixel(planPixelId))
  }

  return (
    <div className="border-t border-white/5 mt-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-xs text-white/40 hover:text-white/60 transition-colors group"
      >
        <span className="flex items-center gap-2">
          <ScanLine className="w-3.5 h-3.5" />
          <span className="font-semibold uppercase tracking-wider">
            Pixels deste plano
          </span>
          {planPixels.length > 0 && (
            <span className="bg-[#00e88a]/20 text-[#00e88a] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {planPixels.length}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          {planPixels.length === 0 ? (
            <p className="text-xs text-white/25 italic">Nenhum pixel vinculado. Adicione um para rastrear conversões deste plano.</p>
          ) : (
            <div className="space-y-2">
              {planPixels.map(pp => {
                const badge = PLATFORM_BADGES[pp.pixel.platform] ?? PLATFORM_BADGES.meta
                return (
                  <div key={pp.id} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${badge.color}`}>
                        <img src={badge.icon} alt={badge.label} className="w-3.5 h-3.5 object-contain" />
                        {badge.label}
                      </span>
                      <span className="text-sm text-white font-medium">{pp.pixel.name}</span>
                      <span className="text-xs text-white/30 font-mono">{pp.pixel.pixel_id}</span>
                    </div>
                    <button
                      onClick={() => handleRemove(pp.id)}
                      disabled={isPending}
                      className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add pixel */}
          {!showSelect ? (
            <button
              onClick={() => setShowSelect(true)}
              disabled={unlinked.length === 0}
              className="flex items-center gap-1.5 text-xs text-[#00e88a] hover:text-[#00e88a]/80 font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              {unlinked.length === 0 ? 'Nenhum pixel disponível — cadastre em Configurações › Pixels' : 'Adicionar pixel'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <select
                onChange={e => { if (e.target.value) handleAdd(e.target.value) }}
                defaultValue=""
                className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-[#00e88a]/50 outline-none"
              >
                <option value="" disabled>Selecionar pixel...</option>
                {unlinked.map(p => {
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.platform.toUpperCase()})
                    </option>
                  )
                })}
              </select>
              {isPending && <Loader2 className="w-4 h-4 text-white/40 animate-spin flex-shrink-0" />}
              <button onClick={() => setShowSelect(false)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
