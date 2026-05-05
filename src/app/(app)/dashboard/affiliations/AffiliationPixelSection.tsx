'use client'

import { useState, useTransition } from 'react'
import { ScanLine, Plus, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { addAffiliationPixel, removeAffiliationPixel } from '../pixels/actions'

const PLATFORM_BADGES: Record<string, { label: string; icon: string; color: string }> = {
  meta:   { label: 'Meta Ads',    icon: '🔵', color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
  google: { label: 'Google Ads',  icon: '🔴', color: 'bg-red-500/10 border-red-500/20 text-red-400' },
  tiktok: { label: 'TikTok',      icon: '⚫', color: 'bg-white/5 border-white/10 text-white/60' },
}

interface Pixel        { id: string; name: string; platform: string; pixel_id: string }
interface AffPixelRow  { id: string; pixel: Pixel }

interface Props {
  affiliationId: string
  affPixels: AffPixelRow[]
  availablePixels: Pixel[]
}

export function AffiliationPixelSection({ affiliationId, affPixels, availablePixels }: Props) {
  const [open, setOpen] = useState(false)
  const [showSelect, setShowSelect] = useState(false)
  const [isPending, startTransition] = useTransition()

  const linkedIds = new Set(affPixels.map(ap => ap.pixel.id))
  const unlinked   = availablePixels.filter(p => !linkedIds.has(p.id))

  function handleAdd(pixelId: string) {
    startTransition(async () => {
      await addAffiliationPixel(affiliationId, pixelId)
      setShowSelect(false)
    })
  }

  function handleRemove(affPixelId: string) {
    startTransition(() => removeAffiliationPixel(affPixelId))
  }

  return (
    <div className="border-t border-white/5">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-3.5 text-xs text-white/40 hover:text-white/60 transition-colors"
      >
        <span className="flex items-center gap-2">
          <ScanLine className="w-3.5 h-3.5" />
          <span className="font-semibold uppercase tracking-wider">Meus pixels de rastreamento</span>
          {affPixels.length > 0 && (
            <span className="bg-[#00e88a]/20 text-[#00e88a] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {affPixels.length}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-6 pb-5 space-y-3">
          {/* Info note */}
          <p className="text-xs text-white/30 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2.5 leading-relaxed">
            📡 Seus pixels são disparados quando um comprador acessa o checkout pelo <strong className="text-white/50">seu link</strong>. 
            Isso permite rastrear suas campanhas independentemente do produtor.
          </p>

          {/* Linked pixels list */}
          {affPixels.length === 0 ? (
            <p className="text-xs text-white/25 italic">Nenhum pixel vinculado a esta afiliação.</p>
          ) : (
            <div className="space-y-2">
              {affPixels.map(ap => {
                const badge = PLATFORM_BADGES[ap.pixel.platform] ?? PLATFORM_BADGES.meta
                return (
                  <div key={ap.id} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold flex-shrink-0 ${badge.color}`}>
                        {badge.icon} {badge.label}
                      </span>
                      <span className="text-sm text-white font-medium truncate">{ap.pixel.name}</span>
                      <span className="text-xs text-white/30 font-mono hidden md:block">{ap.pixel.pixel_id}</span>
                    </div>
                    <button
                      onClick={() => handleRemove(ap.id)}
                      disabled={isPending}
                      className="ml-2 p-1.5 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add pixel selector */}
          {!showSelect ? (
            <button
              onClick={() => setShowSelect(true)}
              disabled={unlinked.length === 0}
              className="flex items-center gap-1.5 text-xs text-[#00e88a] hover:text-[#00e88a]/80 font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              {unlinked.length === 0
                ? 'Nenhum pixel disponível — cadastre em Configurações › Pixels'
                : 'Adicionar pixel'}
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
                  const badge = PLATFORM_BADGES[p.platform]
                  return (
                    <option key={p.id} value={p.id}>
                      {badge?.icon} {p.name} ({p.platform.toUpperCase()})
                    </option>
                  )
                })}
              </select>
              {isPending && <Loader2 className="w-4 h-4 text-white/40 animate-spin flex-shrink-0" />}
              <button onClick={() => setShowSelect(false)} className="text-white/30 hover:text-white transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
