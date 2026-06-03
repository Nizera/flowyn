"use client"

import { useEffect, useRef, useState, useTransition } from 'react'
import { Check, Eye, Monitor, Save, Smartphone, Sparkles } from 'lucide-react'
import { FileUpload } from '@/components/FileUpload'
import type { CheckoutCustomizationConfig } from '@/lib/checkout-customization'
import { publishCheckout, saveCheckoutDraft } from './actions'

type CheckoutEditorClientProps = {
  productId: string
  userId: string
  product: any
  plans: any[]
  initialConfig: CheckoutCustomizationConfig
  publishedAt: string | null
}

export function CheckoutEditorClient({
  productId,
  userId,
  product,
  plans,
  initialConfig,
  publishedAt,
}: CheckoutEditorClientProps) {
  const [config, setConfig] = useState(initialConfig)
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [previewKey, setPreviewKey] = useState(0)
  const [previewFrameWidth, setPreviewFrameWidth] = useState(0)
  const previewFrameRef = useRef<HTMLDivElement | null>(null)
  const [isPending, startTransition] = useTransition()
  const plan = plans[0]
  const orderBumpEnabled = Boolean(product.order_bump_price)
  const previewUrl = plan?.id ? `/checkout/${plan.id}?preview=1&draft=1&v=${previewKey}` : ''
  const intrinsicPreviewWidth = viewport === 'mobile' ? 390 : 1280
  const intrinsicPreviewHeight = viewport === 'mobile' ? 1900 : 2200
  const previewScale = previewFrameWidth ? Math.min(1, previewFrameWidth / intrinsicPreviewWidth) : 1
  const previewHeight = Math.ceil(intrinsicPreviewHeight * previewScale)

  useEffect(() => {
    const element = previewFrameRef.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      setPreviewFrameWidth(entry.contentRect.width)
    })
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

  function handlePublish() {
    startTransition(async () => {
      await publishCheckout(productId, config)
      setPreviewKey(current => current + 1)
    })
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-20 z-20 rounded-3xl border border-white/10 bg-[#111]/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#00e88a]/25 bg-[#00e88a]/10 px-3 py-1 text-xs font-black text-[#00e88a]">
              <Sparkles className="h-3.5 w-3.5" />
              Checkout transparente
            </div>
            <h2 className="mt-2 text-xl font-black text-white">Construtor visual</h2>
            <p className="mt-1 text-xs text-white/40">
              {publishedAt ? `Publicado em ${new Date(publishedAt).toLocaleString('pt-BR')}` : 'Edite o rascunho e publique quando estiver pronto'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
              <button onClick={() => setViewport('desktop')} className={`rounded-lg p-2 ${viewport === 'desktop' ? 'bg-[#00e88a] text-black' : 'text-white/45'}`} title="Desktop">
                <Monitor className="h-4 w-4" />
              </button>
              <button onClick={() => setViewport('mobile')} className={`rounded-lg p-2 ${viewport === 'mobile' ? 'bg-[#00e88a] text-black' : 'text-white/45'}`} title="Mobile">
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
            <button
              disabled={isPending}
              onClick={handleSaveDraft}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Salvar rascunho
            </button>
            <button
              disabled={isPending}
              onClick={handlePublish}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00e88a] px-5 py-3 text-sm font-black text-black transition hover:bg-[#04f294] disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Publicar
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-4">

        <Panel title="Imagens">
          <FileUpload
            mode="image"
            label="Banner do checkout"
            hint="Imagem horizontal para o topo do checkout"
            userId={userId}
            folder="checkout-assets"
            currentUrl={config.bannerImageUrl}
            onUpload={(url) => update('bannerImageUrl', url)}
            onRemove={() => update('bannerImageUrl', '')}
          />
          <FileUpload
            mode="image"
            label="Mockup do produto"
            hint="Arraste ou anexe uma imagem do produto"
            userId={userId}
            folder="checkout-assets"
            currentUrl={config.mockupImageUrl}
            onUpload={(url) => update('mockupImageUrl', url)}
            onRemove={() => update('mockupImageUrl', '')}
          />
          {orderBumpEnabled && (
            <FileUpload
              mode="image"
              label="Imagem do order bump"
              hint="Imagem usada na oferta extra"
              userId={userId}
              folder="checkout-assets"
              currentUrl={config.orderBumpImageUrl}
              onUpload={(url) => update('orderBumpImageUrl', url)}
              onRemove={() => update('orderBumpImageUrl', '')}
            />
          )}
        </Panel>

        <Panel title="Copy">
          <Field label="Headline" value={config.headline} onChange={(value) => update('headline', value)} />
          <Field label="Subheadline" value={config.subheadline} onChange={(value) => update('subheadline', value)} textarea />
          <Field label="Texto do botão" value={config.buttonText} onChange={(value) => update('buttonText', value)} />
          <Field label="Selo de segurança" value={config.securityText} onChange={(value) => update('securityText', value)} />
          <Field label="Garantia" value={config.guaranteeText} onChange={(value) => update('guaranteeText', value)} textarea />
        </Panel>

        <Panel title="Estilo">
          <ColorField label="Cor primária" value={config.primaryColor} onChange={(value) => update('primaryColor', value)} />
          <ColorField label="Fundo" value={config.backgroundColor} onChange={(value) => update('backgroundColor', value)} />
        </Panel>

        <Panel title="Blocos">
          {Object.entries(config.blocks).map(([key, value]) => (
            <label key={key} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-white/65">
              {blockLabel(key)}
              <input type="checkbox" checked={value} onChange={(event) => updateBlock(key as keyof CheckoutCustomizationConfig['blocks'], event.target.checked)} className="accent-[#00e88a]" />
            </label>
          ))}
          <Field label="Benefícios, um por linha" value={config.benefits.join('\n')} onChange={(value) => updateList('benefits', value)} textarea />
        </Panel>

      </aside>

      <section className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-[#0f0f0f] p-4 lg:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white/60">
            <Eye className="h-4 w-4 text-[#00e88a]" />
            Preview do checkout
          </div>
          <span className="text-xs font-bold uppercase text-white/30">{viewport}</span>
        </div>
        {previewUrl ? (
          <div
            ref={previewFrameRef}
            className={`mx-auto max-w-full overflow-hidden rounded-[28px] border border-white/15 bg-white shadow-2xl transition-all ${viewport === 'mobile' ? 'w-[390px]' : 'w-full'}`}
            style={{ height: previewHeight }}
          >
            <div
              style={{
                width: intrinsicPreviewWidth,
                height: intrinsicPreviewHeight,
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
              }}
            >
              <iframe
                key={previewUrl}
                src={previewUrl}
                title="Preview real do checkout"
                className="block h-full w-full border-0 bg-white"
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-center text-sm font-bold text-white/45">
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
    <div className="space-y-4 rounded-3xl border border-white/10 bg-[#111] p-5">
      <h3 className="text-sm font-black uppercase text-white/45">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, textarea = false }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase text-white/35">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-24 w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white outline-none focus:border-[#00e88a]" />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white outline-none focus:border-[#00e88a]" />
      )}
    </label>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-xs font-bold uppercase text-white/35">{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-16 rounded-lg border border-white/10 bg-transparent" />
    </label>
  )
}

function blockLabel(key: string) {
  const labels: Record<string, string> = {
    banner: 'Banner',
    benefits: 'Benefícios',
    testimonials: 'Depoimentos',
    faq: 'FAQ',
    guarantee: 'Garantia',
  }
  return labels[key] || key
}
