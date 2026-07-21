"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { AlertCircle, Check, ExternalLink, Eye, Loader2, Monitor, RefreshCw, Save, Smartphone, Trash2, Plus } from 'lucide-react'
import { FileUpload } from '@/components/FileUpload'
import type { CheckoutCustomizationConfig } from '@/lib/checkout-customization'
import { publishCheckout, saveCheckoutDraft } from './actions'

type CheckoutEditorClientProps = {
  productId: string
  userId: string
  product: {
    order_bump_price?: string | number | null
    name?: string | null
    short_description?: string | null
    description?: string | null
    checkout_banner_url?: string | null
    logo_url?: string | null
    order_bump_image_url?: string | null
  }
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
  const [autoSaved, setAutoSaved] = useState(false)
  const [bannerWarning, setBannerWarning] = useState<string | null>(null)
  const previewFrameRef = useRef<HTMLDivElement | null>(null)
  const previewTimeoutRef = useRef<number | null>(null)
  const autoSaveTimerRef = useRef<number | null>(null)
  const latestConfigRef = useRef(config)
  const [isPending, startTransition] = useTransition()
  const plan = plans[0]
  const orderBumpEnabled = Boolean(product.order_bump_price)
  const previewUrl = plan?.id ? `/checkout/${plan.id}?preview=1&draft=1&v=${previewKey}` : ''
  const intrinsicPreviewWidth = viewport === 'mobile' ? 390 : 1280
  const intrinsicPreviewHeight = viewport === 'mobile' ? 1900 : 2200
  const previewScale = previewFrameWidth ? Math.min(1, previewFrameWidth / intrinsicPreviewWidth) : 1
  const previewHeight = Math.ceil(intrinsicPreviewHeight * previewScale)

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current)
      if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current)
    }
  }, [])

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

  const scheduleAutoSave = useCallback(() => {
    setAutoSaved(false)
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = window.setTimeout(async () => {
      try {
        await saveCheckoutDraft(productId, latestConfigRef.current)
        setPreviewKey(c => c + 1)
        setAutoSaved(true)
      } catch {
        // Error logged server-side by saveCheckoutDraft
      }
    }, 1500)
  }, [productId])

  function update<K extends keyof CheckoutCustomizationConfig>(key: K, value: CheckoutCustomizationConfig[K]) {
    setConfig(current => {
      const next = { ...current, [key]: value }
      latestConfigRef.current = next
      return next
    })
    scheduleAutoSave()
  }

  function updateBlock(key: keyof CheckoutCustomizationConfig['blocks'], value: boolean) {
    setConfig(current => {
      const next = { ...current, blocks: { ...current.blocks, [key]: value } }
      latestConfigRef.current = next
      return next
    })
    scheduleAutoSave()
  }

  function updateList(key: 'benefits', value: string) {
    update(key, value.split('\n').map(item => item.trim()).filter(Boolean))
  }

  function handleSaveDraft() {
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current)
    startTransition(async () => {
      await saveCheckoutDraft(productId, config)
      setPreviewKey(current => current + 1)
      setAutoSaved(true)
    })
  }

  function handleRefreshPreview() {
    handleSaveDraft()
  }

  function handlePublish() {
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current)
    const hasDesktop = Boolean(config.bannerImageUrl)
    const hasMobile = Boolean(config.bannerMobileImageUrl)
    if (hasDesktop !== hasMobile) {
      setBannerWarning(hasDesktop
        ? 'Voce adicionou o banner desktop, mas falta o banner mobile. Adicione os dois para publicar.'
        : 'Voce adicionou o banner mobile, mas falta o banner desktop. Adicione os dois para publicar.')
      return
    }
    setBannerWarning(null)
    startTransition(async () => {
      const result = await publishCheckout(productId, config)
      if (result?.error) {
        setBannerWarning(result.error)
        return
      }
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

      {bannerWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {bannerWarning}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-6 overflow-y-auto pr-2 sidebar-scrollbar xl:max-h-[calc(100vh-12rem)]">
          <Panel title="Imagens">
            <FileUpload mode="image" label="Banner desktop" hint="Imagem horizontal para o topo do checkout" dimensionsHint="Recomendado: 1280 × 320px" userId={userId} folder="checkout-assets" currentUrl={config.bannerImageUrl} onUpload={(url) => update('bannerImageUrl', Array.isArray(url) ? url[0] : url)} onRemove={() => update('bannerImageUrl', '')} />
            <FileUpload mode="image" label="Banner mobile" hint="Imagem para a versao mobile do checkout" dimensionsHint="Recomendado: 750 × 300px" userId={userId} folder="checkout-assets" currentUrl={config.bannerMobileImageUrl} onUpload={(url) => update('bannerMobileImageUrl', Array.isArray(url) ? url[0] : url)} onRemove={() => update('bannerMobileImageUrl', '')} />
            <FileUpload mode="image" label="Mockup do produto" hint="Arraste ou anexe uma imagem do produto" dimensionsHint="Recomendado: 400 × 400px (quadrado)" userId={userId} folder="checkout-assets" currentUrl={config.mockupImageUrl} onUpload={(url) => update('mockupImageUrl', Array.isArray(url) ? url[0] : url)} onRemove={() => update('mockupImageUrl', '')} />
            {orderBumpEnabled && (
              <FileUpload mode="image" label="Imagem do order bump" hint="Imagem usada na oferta extra" dimensionsHint="Recomendado: 200 × 200px (quadrado)" userId={userId} folder="checkout-assets" currentUrl={config.orderBumpImageUrl} onUpload={(url) => update('orderBumpImageUrl', Array.isArray(url) ? url[0] : url)} onRemove={() => update('orderBumpImageUrl', '')} />
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
            <label className="flex items-center justify-between rounded-xl bg-[#f4f4f6] px-4 py-3 text-sm font-medium text-slate-700">
              Mostrar faixa de urgencia
              <input type="checkbox" checked={config.blocks.urgency} onChange={(event) => updateBlock('urgency', event.target.checked)} className="accent-orange-500" />
            </label>
            {config.blocks.urgency && (
              <>
                <ColorField label="Cor da faixa" value={config.urgencyBarColor} onChange={(value) => update('urgencyBarColor', value)} />
                <Field label="Frases de urgencia (uma por linha)" value={config.urgencyPhrases.join('\n')} onChange={(value) => update('urgencyPhrases', value.split('\n').map(item => item.trim()).filter(Boolean))} textarea />
              </>
            )}
          </Panel>

          <Panel title="Estilo">
            <ColorField label="Cor primaria" value={config.primaryColor} onChange={(value) => update('primaryColor', value)} />
            <ColorField label="Fundo" value={config.backgroundColor} onChange={(value) => update('backgroundColor', value)} />
          </Panel>

          <Panel title="Blocos">
            {Object.entries(config.blocks).filter(([key]) => key !== 'urgency').map(([key, value]) => (
              <label key={key} className="flex items-center justify-between rounded-xl bg-[#f4f4f6] px-4 py-3 text-sm font-medium text-slate-700">
                {blockLabel(key)}
                <input type="checkbox" checked={value} onChange={(event) => updateBlock(key as keyof CheckoutCustomizationConfig['blocks'], event.target.checked)} className="accent-orange-500" />
              </label>
            ))}
            <Field label="Beneficios, um por linha" value={config.benefits.join('\n')} onChange={(value) => updateList('benefits', value)} textarea />

            {config.blocks.testimonials && (
              <div className="mt-2 space-y-2">
                <p className="text-xs font-semibold text-slate-500">Depoimentos ({config.testimonials.length} de 6)</p>
                <TestimonialList items={config.testimonials} onChange={(items) => update('testimonials', items)} userId={userId} />
              </div>
            )}

            {config.blocks.faq && (
              <div className="mt-2 space-y-2">
                <p className="text-xs font-semibold text-slate-500">FAQ ({config.faq.length} de 8)</p>
                <FaqList items={config.faq} onChange={(items) => update('faq', items)} />
              </div>
            )}
          </Panel>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-4 lg:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <Eye className="h-4 w-4 text-orange-600" />
              Preview do checkout
              {autoSaved && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                  <Check className="h-3 w-3" />
                  Salvo
                </span>
              )}
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

function TestimonialList({ items, onChange, userId }: { items: Array<{ name: string; text: string; imageUrl: string }>; onChange: (items: Array<{ name: string; text: string; imageUrl: string }>) => void; userId: string }) {
  function update(index: number, field: 'name' | 'text' | 'imageUrl', value: string) {
    onChange(items.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }
  function add() {
    if (items.length >= 6) return
    onChange([...items, { name: '', text: '', imageUrl: '' }])
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 transition">
              <Trash2 className="h-3 w-3" />
              Remover
            </button>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Nome</span>
            <input value={item.name} onChange={(e) => update(i, 'name', e.target.value)} maxLength={100} className="h-10 w-full rounded-lg border-0 bg-[#f4f4f6] px-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Depoimento</span>
            <textarea value={item.text} onChange={(e) => update(i, 'text', e.target.value)} maxLength={500} className="min-h-16 w-full rounded-lg border-0 bg-[#f4f4f6] px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20" />
          </label>
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-500">Foto (opcional)</span>
            {item.imageUrl ? (
              <div className="flex items-center gap-2">
                <img src={item.imageUrl} alt="Avatar" className="h-10 w-10 rounded-full border border-slate-200 object-cover" />
                <button type="button" onClick={() => update(i, 'imageUrl', '')} className="text-xs font-semibold text-red-500 hover:text-red-700 transition">
                  Remover foto
                </button>
              </div>
            ) : (
              <FileUpload mode="image" label="" hint="Foto de perfil" dimensionsHint="100x100px" userId={userId} folder="checkout-assets" currentUrl="" onUpload={(url) => update(i, 'imageUrl', Array.isArray(url) ? url[0] : url)} />
            )}
          </div>
        </div>
      ))}
      {items.length < 6 && (
        <button type="button" onClick={add} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-orange-400 hover:text-orange-600">
          <Plus className="h-3.5 w-3.5" />
          Adicionar depoimento
        </button>
      )}
    </div>
  )
}

function FaqList({ items, onChange }: { items: Array<{ question: string; answer: string }>; onChange: (items: Array<{ question: string; answer: string }>) => void }) {
  function update(index: number, field: 'question' | 'answer', value: string) {
    onChange(items.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }
  function add() {
    if (items.length >= 8) return
    onChange([...items, { question: '', answer: '' }])
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 transition">
              <Trash2 className="h-3 w-3" />
              Remover
            </button>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Pergunta</span>
            <input value={item.question} onChange={(e) => update(i, 'question', e.target.value)} maxLength={200} className="h-10 w-full rounded-lg border-0 bg-[#f4f4f6] px-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Resposta</span>
            <textarea value={item.answer} onChange={(e) => update(i, 'answer', e.target.value)} maxLength={500} className="min-h-16 w-full rounded-lg border-0 bg-[#f4f4f6] px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20" />
          </label>
        </div>
      ))}
      {items.length < 8 && (
        <button type="button" onClick={add} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-orange-400 hover:text-orange-600">
          <Plus className="h-3.5 w-3.5" />
          Adicionar pergunta
        </button>
      )}
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
    <div className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-24 w-full rounded-xl border-0 bg-[#f4f4f6] px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20" />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-xl border-0 bg-[#f4f4f6] px-4 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20" />
      )}
    </div>
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
    urgency: 'Urgencia',
  }
  return labels[key] || key
}
