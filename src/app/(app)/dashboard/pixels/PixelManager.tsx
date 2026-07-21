'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react'
import { createPixel, deletePixel, togglePixel } from './actions'

const PLATFORMS = [
  { id: 'meta', label: 'Meta Ads', sublabel: 'Facebook & Instagram', icon: '/meta.png', color: 'bg-orange-50 border-orange-100 text-orange-600', hint: 'Ex: 1234567890123456' },
  { id: 'google', label: 'Google Ads', sublabel: 'Search & Display', icon: '/google.png', color: 'bg-red-50 border-red-100 text-red-700', hint: 'Ex: AW-123456789' },
  { id: 'tiktok', label: 'TikTok Ads', sublabel: 'TikTok & Reels', icon: '/tiktok.png', color: 'bg-surface border-border text-muted', hint: 'Ex: C1AB2DEF3GH' },
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
    <section className="overflow-hidden rounded-[10px] bg-card px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Pixels</h2>
          <p className="mt-2 text-sm text-muted">Cadastre pixels e vincule-os aos planos para rastrear conversoes.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600">
          <Plus className="h-4 w-4" />
          Cadastrar
        </button>
      </div>

      <div className="mt-10 grid border-y border-border md:grid-cols-[240px_1fr]">
        <RowTitle title="Plataformas" description="Canais suportados." />
        <div className="grid gap-4 py-6 md:grid-cols-3 md:pl-8">
          {PLATFORMS.map(p => (
            <div key={p.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${p.color}`}>
              <img src={p.icon} alt={p.label} className="h-8 w-8 shrink-0 object-contain" />
              <div>
                <p className="text-sm font-bold">{p.label}</p>
                <p className="text-xs opacity-70">{p.sublabel}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid border-b border-border md:grid-cols-[240px_1fr]">
        <RowTitle title="Pixels cadastrados" description="Lista da sua conta." />
        <div className="py-6 md:pl-8">
          {initialPixels.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
              <h3 className="font-semibold text-foreground">Nenhum pixel cadastrado</h3>
              <p className="mt-1 text-sm text-muted">Cadastre seu primeiro pixel para rastrear conversoes no checkout.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border text-sm font-medium text-foreground">
                  <tr>
                    <th className="px-5 py-4">Nome</th>
                    <th className="px-5 py-4">Plataforma</th>
                    <th className="px-5 py-4">ID do pixel</th>
                    <th className="px-5 py-4 text-center">Status</th>
                    <th className="px-5 py-4 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {initialPixels.map(pixel => {
                    const plat = getPlatform(pixel.platform)
                    return (
                      <tr key={pixel.id} className="transition hover:bg-surface">
                        <td className="px-5 py-4 font-semibold text-foreground">{pixel.name}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${plat.color}`}>
                            <img src={plat.icon} alt={plat.label} className="h-4 w-4 object-contain" />
                            {plat.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-muted">{pixel.pixel_id}</td>
                        <td className="px-5 py-4 text-center">
                          <button onClick={() => handleToggle(pixel.id, pixel.is_active)} className="inline-flex items-center gap-1.5 transition-colors">
                            {pixel.is_active ? (
                              <>
                                <ToggleRight className="h-5 w-5 text-emerald-600" />
                                <span className="text-xs font-medium text-emerald-700">Ativo</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="h-5 w-5 text-muted" />
                                <span className="text-xs font-medium text-muted">Inativo</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button onClick={() => handleDelete(pixel.id)} className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[14px] bg-card p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)] ring-1 ring-border">
            <div className="mb-7 flex items-start justify-between gap-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Cadastrar novo pixel</h2>
                <p className="mt-1 text-sm text-muted">Informe plataforma, nome e ID de rastreamento.</p>
              </div>
              <button onClick={() => { setShowModal(false); setSelectedPlatform(null) }} className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={handleCreate} className="space-y-5">
              <div>
                <label className="mb-3 block text-sm font-medium text-foreground">Plataforma *</label>
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.map(p => (
                    <button key={p.id} type="button" onClick={() => setSelectedPlatform(p.id)} className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition ${selectedPlatform === p.id ? 'border-orange-300 bg-orange-50 ring-2 ring-orange-500/10' : 'border-border bg-card hover:bg-surface'}`}>
                      <img src={p.icon} alt={p.label} className="h-8 w-8 object-contain" />
                      <span className="text-xs font-semibold leading-tight text-foreground">{p.label}</span>
                    </button>
                  ))}
                </div>
                <input type="hidden" name="platform" value={selectedPlatform ?? ''} />
              </div>

              <Field label="Nome do pixel">
                <input name="name" required placeholder="Ex: Meta Principal" className={inputClass} />
              </Field>
              <Field label="ID do pixel">
                <input name="pixel_id" required placeholder={selectedPlatform ? getPlatform(selectedPlatform).hint : 'Selecione a plataforma primeiro'} className={`${inputClass} font-mono`} />
              </Field>

              {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700 ring-1 ring-red-100">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setSelectedPlatform(null) }} className="flex-1 rounded-xl px-4 py-3 text-sm font-medium text-red-500 transition hover:bg-red-50">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending || !selectedPlatform} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-40">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

const inputClass = 'h-12 w-full rounded-xl border-0 bg-surface px-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted focus:bg-card focus:ring-2 focus:ring-orange-500/20'

function RowTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-6 md:pr-8">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}
