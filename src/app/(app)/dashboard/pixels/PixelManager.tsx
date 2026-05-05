'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, X, Loader2 } from 'lucide-react'
import { createPixel, deletePixel, togglePixel } from './actions'

const PLATFORMS = [
  {
    id: 'meta',
    label: 'Meta Ads',
    sublabel: 'Facebook & Instagram',
    icon: '/meta.png',
    color: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    hint: 'Ex: 1234567890123456',
  },
  {
    id: 'google',
    label: 'Google Ads',
    sublabel: 'Search & Display',
    icon: '/google.png',
    color: 'bg-red-500/10 border-red-500/20 text-red-400',
    hint: 'Ex: AW-123456789',
  },
  {
    id: 'tiktok',
    label: 'TikTok Ads',
    sublabel: 'TikTok & Reels',
    icon: '/tiktok.png',
    color: 'bg-white/5 border-white/10 text-white/70',
    hint: 'Ex: C1AB2DEF3GH',
  },
]

function getPlatform(id: string) {
  return PLATFORMS.find(p => p.id === id) ?? PLATFORMS[0]
}

interface Pixel {
  id: string
  name: string
  platform: string
  pixel_id: string
  is_active: boolean
  created_at: string
}

export function PixelManager({ initialPixels }: { initialPixels: Pixel[] }) {
  const [showModal, setShowModal] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleCreate(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createPixel(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setShowModal(false)
        setSelectedPlatform(null)
      }
    })
  }

  function handleToggle(pixelId: string, current: boolean) {
    startTransition(() => togglePixel(pixelId, !current))
  }

  function handleDelete(pixelId: string) {
    if (!confirm('Remover este pixel?')) return
    startTransition(() => deletePixel(pixelId))
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Pixels de Rastreamento</h1>
          <p className="text-sm text-white/40 mt-1">
            Cadastre seus pixels e vincule-os aos planos ou afiliações para rastrear conversões.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#00e88a] hover:bg-[#00d47e] text-black font-bold text-sm px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Cadastrar Pixel
        </button>
      </div>

      {/* Platform cards info */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {PLATFORMS.map(p => (
          <div key={p.id} className={`border rounded-2xl p-4 flex items-center gap-3 ${p.color}`}>
            <img src={p.icon} alt={p.label} className="w-8 h-8 object-contain flex-shrink-0" />
            <div>
              <p className="font-bold text-sm">{p.label}</p>
              <p className="text-xs opacity-60">{p.sublabel}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pixel List */}
      {initialPixels.length === 0 ? (
        <div className="bg-[#111111] border border-white/5 rounded-2xl flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-2xl mb-4">📡</div>
          <p className="font-bold text-white/50 text-base">Nenhum pixel cadastrado</p>
          <p className="text-sm text-white/25 mt-1 max-w-xs">
            Cadastre seu primeiro pixel para começar a rastrear conversões no checkout.
          </p>
        </div>
      ) : (
        <div className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-white/30 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-4">Nome</th>
                <th className="text-left px-6 py-4">Plataforma</th>
                <th className="text-left px-6 py-4">ID do Pixel</th>
                <th className="text-center px-6 py-4">Status</th>
                <th className="text-right px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {initialPixels.map(pixel => {
                const plat = getPlatform(pixel.platform)
                return (
                  <tr key={pixel.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-semibold text-white">{pixel.name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${plat.color}`}>
                        <img src={plat.icon} alt={plat.label} className="w-4 h-4 object-contain" /> {plat.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-white/50 text-xs">{pixel.pixel_id}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggle(pixel.id, pixel.is_active)}
                        className="inline-flex items-center gap-1.5 transition-colors"
                      >
                        {pixel.is_active ? (
                          <>
                            <ToggleRight className="w-5 h-5 text-[#00e88a]" />
                            <span className="text-xs text-[#00e88a] font-medium">Ativo</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-5 h-5 text-white/30" />
                            <span className="text-xs text-white/30 font-medium">Inativo</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(pixel.id)}
                        className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
              <h2 className="font-bold text-white text-lg">Cadastrar novo pixel</h2>
              <button onClick={() => { setShowModal(false); setSelectedPlatform(null) }}
                className="text-white/30 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form action={handleCreate} className="p-6 space-y-5">
              {/* Platform selector */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                  Plataforma *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlatform(p.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-center ${
                        selectedPlatform === p.id
                          ? 'border-[#00e88a] bg-[#00e88a]/10 shadow-[0_0_12px_rgba(0,232,138,0.15)]'
                          : 'border-white/10 hover:border-white/20 bg-white/5'
                      }`}
                    >
                      <img src={p.icon} alt={p.label} className="w-8 h-8 object-contain" />
                      <span className="text-xs font-semibold text-white leading-tight">{p.label}</span>
                    </button>
                  ))}
                </div>
                <input type="hidden" name="platform" value={selectedPlatform ?? ''} />
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Nome do pixel *
                </label>
                <input
                  name="name"
                  required
                  placeholder="Ex: Meta Principal, Google Conversões"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#00e88a]/50 transition-colors"
                />
              </div>

              {/* Pixel ID */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  ID do Pixel *
                </label>
                <input
                  name="pixel_id"
                  required
                  placeholder={selectedPlatform ? getPlatform(selectedPlatform).hint : 'Selecione a plataforma primeiro'}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 font-mono focus:outline-none focus:border-[#00e88a]/50 transition-colors"
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setSelectedPlatform(null) }}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition-all font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !selectedPlatform}
                  className="flex-1 py-3 rounded-xl bg-[#00e88a] hover:bg-[#00d47e] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
