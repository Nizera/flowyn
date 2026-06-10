"use client"

import { useEffect, useRef, useState, useTransition } from 'react'
import { AlertCircle, Check, ExternalLink, Eye, Loader2, Monitor, RefreshCw, Save, Smartphone } from 'lucide-react'
import { FileUpload } from '@/components/FileUpload'
import type { CheckoutCustomizationConfig } from '@/lib/checkout-customization'
import { publishCheckout, saveCheckoutDraft } from './actions'

type CheckoutEditorClientProps = {
  productId: string
  userId: string
  product: { order_bump_price?: string | number | null }
  plans: Array<{ id?: string }>
  initialConfig: CheckoutCustomizationConfig
  publishedAt: string | null
}

export function CheckoutEditorClient({ productId, userId, product, plans, initialConfig, publishedAt }: CheckoutEditorClientProps) {
  const [config, setConfig] = useState(initialConfig)
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [previewKey, setPreviewKey] = useState(0)
  const [previewFrameWidth, setPreviewFrameWidth] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(Boolean(plans[0]?.id))
  const [previewError, setPreviewError] = useState(false)
  const previewFrameRef = useRef<HTMLDivElement | null>(null)
  const previewTimeoutRef = useRef<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const plan = plans[0]
  const orderBumpEnabled = Boolean(product.order_bump_price)
  const previewUrl = plan?.id ? `/checkout/${plan.id}?preview=1&draft=1&v=${previewKey}` : ''
  const intrinsicPreviewWidth = viewport === 'mobile' ? 390 : 1280
  const intrinsicPreviewHeight = viewport === 'mobile' ? 1900 : 2200
  const previewScale = previewFrameWidth ? Math.min(1, previewFrameWidth / intrinsicPreviewWidth) : 1
  const previewHeight = Math.ceil(intrinsicPreviewHeight * previewScale)

  useEffect(() => {
    if (!previewUrl) return
    startTransition(() => {
      setPreviewLoading(true)
      setPreviewError(false)
    })
    if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current)
    previewTimeoutRef.current = window.setTimeout(() => {
      setPreviewLoading(false)
      setPreviewError(true)
    }, 10000)
    return () => {
      if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current)
    }
  }, [previewUrl, startTransition])

  useEffect(() => {
    const element = previewFrameRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setPreviewFrameWidth(entry.contentRect.width))
    observer.observe(element)
    setPreviewFrameWidth(element.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [viewport])

  function update<K extends keyof CheckoutCustomizationConfig>(key: K, value: CheckoutCustomizationConfig[K]) {
    setConfig(current => ({ ...current, [key]: value }))
  }

  function updateBlock(key: keyof CheckoutCustomizationConfig['blocks'], value: boolean) {
    setConfig(current => ({ ...current, blocks: { ...current.blocks, [key]: value } }))
  }

  function updateList(key: 'benefits', value: string) {
    update(key, value.split('\n').map(item => item.trim()).filter(Boolean))
  }

  function handleSaveDraft() {
    startTransition(async () => {
      await saveCheckoutDraft(productId, config)
      setPreviewKey(current => current + 1)
    })
  }

  function handleRefreshPreview() {
    handleSaveDraft()
  }

  function handlePublish() {
    startTransition(async () => {
      await publishCheckout(productId, config)
      setPreviewKey(current => current + 1)
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Checkout transparente</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">Construtor visual</h3>
          <p className="mt-1 text-sm text-slate-400">
            {publishedAt ? `Publicado em ${new Date(publishedAt).toLocaleString('pt-BR')}` : 'Edite o rascunho e publique quando estiver pronto.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-[#f4f4f6] p-1">
            <button onClick={() => setViewport('desktop')} className={`rounded-lg p-2 transition ${viewport === 'desktop' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`} title="Desktop">
              <Monitor className="h-4 w-4" />
            </button>
            <button onClick={() => setViewport('mobile')} className={`rounded-lg p-2 transition ${viewport === 'mobile' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`} title="Mobile">
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
          <button disabled={isPending} onClick={handleSaveDraft} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
            <Save className="h-4 w-4" />
            Salvar rascunho
          </button>
          <button disabled={isPending} onClick={handlePublish} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-50">
            <Check className="h-4 w-4" />
            Publicar
          </button>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Panel title="Imagens">
            <FileUpload mode="image" label="Banner do checkout" hint="Imagem horizontal para o topo do checkout" userId={userId} folder="checkout-assets" currentUrl={config.bannerImageUrl} onUpload={(url) => update('bannerImageUrl', Array.isArray(url) ? url[0] : url)} onRemove={() => update('bannerImageUrl', '')} />
            <FileUpload mode="image" label="Mockup do produto" hint="Arraste ou anexe uma imagem do produto" userId={userId} folder="checkout-assets" currentUrl={config.mockupImageUrl} onUpload={(url) => update('mockupImageUrl', Array.isArray(url) ? url[0] : url)} onRemove={() => update('mockupImageUrl', '')} />
            {orderBumpEnabled && (
              <FileUpload mode="image" label="Imagem do order bump" hint="Imagem usada na oferta extra" userId={userId} folder="checkout-assets" currentUrl={config.orderBumpImageUrl} onUpload={(url) => update('orderBumpImageUrl', Array.isArray(url) ? url[0] : url)} onRemove={() => update('orderBumpImageUrl', '')} />
            )}
          </Panel>

          <Panel title="Copy">
            <Field label="Headline" value={config.headline} onChange={(value) => update('headline', value)} />
            <Field label="Subheadline" value={config.subheadline} onChange={(value) => update('subheadline', value)} textarea />
            <Field label="Texto do botao" value={config.buttonText} onChange={(value) => update('buttonText', value)} />
            <Field label="Selo de seguranca" value={config.securityText} onChange={(value) => update('securityText', value)} />
            <Field label="Garantia" value={config.guaranteeText} onChange={(value) => update('guaranteeText', value)} textarea />
          </Panel>

          <Panel title="Urgencia">
            <Field label="Frases de urgencia (uma por linha)" value={config.urgencyPhrases.join('\n')} onChange={(value) => update('urgencyPhrases', value.split('\n').map(item => item.trim()).filter(Boolean))} textarea />
          </Panel>

          <Panel title="Estilo">
            <ColorField label="Cor primaria" value={config.primaryColor} onChange={(value) => update('primaryColor', value)} />
            <ColorField label="Fundo" value={config.backgroundColor} onChange={(value) => update('backgroundColor', value)} />
          </Panel>

          <Panel title="Blocos">
            {Object.entries(config.blocks).map(([key, value]) => (
              <label key={key} className="flex items-center justify-between rounded-xl bg-[#f4f4f6] px-4 py-3 text-sm font-medium text-slate-700">
                {blockLabel(key)}
                <input type="checkbox" checked={value} onChange={(event) => updateBlock(key as keyof CheckoutCustomizationConfig['blocks'], event.target.checked)} className="accent-orange-500" />
              </label>
            ))}
            <Field label="Beneficios, um por linha" value={config.benefits.join('\n')} onChange={(value) => updateList('benefits', value)} textarea />
          </Panel>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-4 lg:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <Eye className="h-4 w-4 text-orange-600" />
              Preview do checkout
            </div>
            <div className="flex items-center gap-2">
              {previewUrl && (
                <>
                  <button type="button" onClick={handleRefreshPreview} disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50" title="Salvar rascunho e atualizar preview">
                    <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
                    Atualizar
                  </button>
                  <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir
                  </a>
                </>
              )}
              <span className="text-xs font-semibold uppercase text-slate-400">{viewport}</span>
            </div>
          </div>

          {previewUrl ? (
            <div ref={previewFrameRef} className={`relative mx-auto max-w-full overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition-all ${viewport === 'mobile' ? 'w-[390px]' : 'w-full'}`} style={{ height: previewHeight }}>
              {previewLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                  <p className="text-sm font-semibold">Carregando preview real...</p>
                </div>
              )}
              {previewError && (
                <div className="absolute inset-4 z-20 flex flex-col items-center justify-center rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900">
                  <AlertCircle className="mb-3 h-7 w-7" />
                  <p className="text-sm font-black">Nao foi possivel carregar o preview dentro do editor.</p>
                  <p className="mt-2 max-w-md text-xs leading-5 text-amber-800/75">Salve o rascunho e tente atualizar. Se continuar em branco, abra o preview real em outra aba.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button onClick={handleRefreshPreview} className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-black text-white">Salvar e recarregar</button>
                    <a href={previewUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-amber-300 px-4 py-2 text-xs font-black text-amber-950">Abrir preview real</a>
                  </div>
                </div>
              )}
              <div style={{ width: intrinsicPreviewWidth, height: intrinsicPreviewHeight, transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                <iframe
                  key={previewUrl}
                  src={previewUrl}
                  title="Preview real do checkout"
                  className="block h-full w-full border-0 bg-white"
                  sandbox="allow-same-origin allow-scripts"
                  onLoad={() => {
                    if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current)
                    setPreviewLoading(false)
                    setPreviewError(false)
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-400">
              Crie um plano para visualizar o checkout real.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 border-b border-slate-200 pb-6">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, textarea = false }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-24 w-full rounded-xl border-0 bg-[#f4f4f6] px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20" />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-xl border-0 bg-[#f4f4f6] px-4 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20" />
      )}
    </label>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-16 rounded-lg border border-slate-200 bg-transparent" />
    </label>
  )
}

function blockLabel(key: string) {
  const labels: Record<string, string> = {
    banner: 'Banner',
    benefits: 'Beneficios',
    testimonials: 'Depoimentos',
    faq: 'FAQ',
    guarantee: 'Garantia',
  }
  return labels[key] || key
}
