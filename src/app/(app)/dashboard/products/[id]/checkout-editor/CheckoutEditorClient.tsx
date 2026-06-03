"use client"

import { useState, useTransition } from 'react'
import { Check, Eye, Monitor, Save, Smartphone, UploadCloud } from 'lucide-react'
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
  const [isPending, startTransition] = useTransition()
  const plan = plans[0]
  const orderBumpEnabled = Boolean(product.order_bump_price)

  function update<K extends keyof CheckoutCustomizationConfig>(key: K, value: CheckoutCustomizationConfig[K]) {
    setConfig(current => ({ ...current, [key]: value }))
  }

  function updateBlock(key: keyof CheckoutCustomizationConfig['blocks'], value: boolean) {
    setConfig(current => ({ ...current, blocks: { ...current.blocks, [key]: value } }))
  }

  function updateList(key: 'benefits', value: string) {
    update(key, value.split('\n').map(item => item.trim()).filter(Boolean))
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[420px_1fr]">
      <aside className="space-y-5">
        <div className="rounded-3xl border border-white/10 bg-[#111] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-white">Editor visual</h2>
              <p className="mt-1 text-xs text-white/40">
                {publishedAt ? `Publicado em ${new Date(publishedAt).toLocaleString('pt-BR')}` : 'Nenhuma versão publicada ainda'}
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
              <button onClick={() => setViewport('desktop')} className={`rounded-lg p-2 ${viewport === 'desktop' ? 'bg-[#00e88a] text-black' : 'text-white/45'}`}>
                <Monitor className="h-4 w-4" />
              </button>
              <button onClick={() => setViewport('mobile')} className={`rounded-lg p-2 ${viewport === 'mobile' ? 'bg-[#00e88a] text-black' : 'text-white/45'}`}>
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

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

        <div className="grid grid-cols-2 gap-3">
          <button
            disabled={isPending}
            onClick={() => startTransition(() => saveCheckoutDraft(productId, config))}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Salvar
          </button>
          <button
            disabled={isPending}
            onClick={() => startTransition(() => publishCheckout(productId, config))}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00e88a] px-4 py-3 text-sm font-black text-black transition hover:bg-[#04f294] disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Publicar
          </button>
        </div>
      </aside>

      <section className="rounded-3xl border border-white/10 bg-[#111] p-4 lg:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white/60">
            <Eye className="h-4 w-4 text-[#00e88a]" />
            Preview do checkout
          </div>
          <span className="text-xs font-bold uppercase text-white/30">{viewport}</span>
        </div>
        <div className={`mx-auto overflow-hidden rounded-3xl border border-white/10 bg-white transition-all ${viewport === 'mobile' ? 'max-w-[390px]' : 'max-w-5xl'}`}>
          <CheckoutPreview config={config} product={product} plan={plan} mobile={viewport === 'mobile'} />
        </div>
      </section>
    </div>
  )
}

function CheckoutPreview({ config, product, plan, mobile }: { config: CheckoutCustomizationConfig; product: any; plan: any; mobile: boolean }) {
  const orderBumpEnabled = Boolean(product.order_bump_price)
  const price = Number(plan?.price || 0)
  const bumpPrice = Number(product.order_bump_price || 0)

  return (
    <div style={{ backgroundColor: config.backgroundColor }} className="min-h-[760px] text-slate-900">
      {config.blocks.banner && config.bannerImageUrl && (
        <div className="h-44 bg-slate-100">
          <img src={config.bannerImageUrl} alt="Banner" className="h-full w-full object-cover" />
        </div>
      )}
      <div className={`grid gap-8 p-6 ${mobile ? 'grid-cols-1' : 'lg:grid-cols-5 lg:p-10'}`}>
        <main className={mobile ? '' : 'lg:col-span-3'}>
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
              {config.mockupImageUrl ? (
                <img src={config.mockupImageUrl} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <UploadCloud className="h-7 w-7 text-slate-300" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black">{config.headline}</h1>
              <p className="mt-1 text-sm text-slate-500">{config.subheadline}</p>
            </div>
          </div>

          {config.blocks.benefits && config.benefits.length > 0 && (
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              {config.benefits.map(benefit => (
                <div key={benefit} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700">
                  <span style={{ color: config.primaryColor }} className="mr-2">●</span>
                  {benefit}
                </div>
              ))}
            </div>
          )}

          {orderBumpEnabled && (
            <div className="rounded-2xl border-2 border-dashed p-4" style={{ borderColor: config.primaryColor }}>
              <div className="flex gap-4">
                {config.orderBumpImageUrl && <img src={config.orderBumpImageUrl} alt="Order bump" className="h-20 w-20 rounded-xl object-cover" />}
                <div>
                  <p className="text-sm font-black">{product.order_bump_title || 'Oferta especial'}</p>
                  <p className="mt-1 text-xs text-slate-500">{product.order_bump_description || 'Adicione este bônus ao pedido.'}</p>
                  <p className="mt-2 text-sm font-black">+ R$ {bumpPrice.toFixed(2).replace('.', ',')}</p>
                </div>
              </div>
            </div>
          )}
        </main>

        <aside className={mobile ? '' : 'lg:col-span-2'}>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black">Resumo do pedido</h2>
            <div className="mt-5 space-y-3 border-b border-slate-100 pb-5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Produto</span><strong>{product.name}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Plano</span><strong>{plan?.name || 'Acesso completo'}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Preço</span><strong>R$ {price.toFixed(2).replace('.', ',')}</strong></div>
            </div>
            <button style={{ backgroundColor: config.primaryColor }} className="mt-6 w-full rounded-2xl px-5 py-4 text-sm font-black text-black">
              {config.buttonText}
            </button>
            <p className="mt-4 text-center text-xs font-bold text-slate-400">{config.securityText}</p>
            {config.blocks.guarantee && (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">{config.guaranteeText}</div>
            )}
          </div>
        </aside>
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
