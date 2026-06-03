"use client"

import { useState, useTransition } from 'react'
import { Check, CreditCard, Eye, Lock, Monitor, Save, ShieldCheck, Smartphone, Sparkles, UploadCloud } from 'lucide-react'
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
              onClick={() => startTransition(() => saveCheckoutDraft(productId, config))}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Salvar rascunho
            </button>
            <button
              disabled={isPending}
              onClick={() => startTransition(() => publishCheckout(productId, config))}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00e88a] px-5 py-3 text-sm font-black text-black transition hover:bg-[#04f294] disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Publicar
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[360px_1fr]">
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

      <section className="rounded-3xl border border-white/10 bg-[#0f0f0f] p-4 lg:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white/60">
            <Eye className="h-4 w-4 text-[#00e88a]" />
            Preview do checkout
          </div>
          <span className="text-xs font-bold uppercase text-white/30">{viewport}</span>
        </div>
        <div className={`mx-auto overflow-hidden rounded-[28px] border border-white/15 bg-white shadow-2xl transition-all ${viewport === 'mobile' ? 'max-w-[390px]' : 'max-w-6xl'}`}>
          <CheckoutPreview config={config} product={product} plan={plan} mobile={viewport === 'mobile'} />
        </div>
      </section>
      </div>
    </div>
  )
}

function CheckoutPreview({ config, product, plan, mobile }: { config: CheckoutCustomizationConfig; product: any; plan: any; mobile: boolean }) {
  const orderBumpEnabled = Boolean(product.order_bump_price)
  const price = Number(plan?.price || 0)
  const bumpPrice = Number(product.order_bump_price || 0)

  return (
    <div style={{ backgroundColor: config.backgroundColor }} className="min-h-[820px] text-slate-900">
      <div className="border-b border-slate-200 bg-white/95 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${config.primaryColor}22`, color: config.primaryColor }}>
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-950">{product.name}</p>
              <p className="text-xs font-semibold text-slate-500">{config.securityText}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: config.primaryColor }} />
            Dados protegidos
          </div>
        </div>
      </div>

      {config.blocks.banner && config.bannerImageUrl && (
        <div className="mx-auto max-w-6xl px-5 pt-6">
          <img src={config.bannerImageUrl} alt="Banner" className="h-44 w-full rounded-3xl object-cover" />
        </div>
      )}

      <div className={`mx-auto grid max-w-6xl gap-8 px-5 py-8 ${mobile ? 'grid-cols-1' : 'lg:grid-cols-[1fr_390px]'}`}>
        <main className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                {config.mockupImageUrl ? (
                  <img src={config.mockupImageUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <UploadCloud className="h-7 w-7 text-slate-300" />
                )}
              </div>
              <div>
                <h1 className="text-3xl font-black leading-tight text-slate-950">{config.headline}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{config.subheadline}</p>
              </div>
            </div>

            {config.blocks.benefits && config.benefits.length > 0 && (
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {config.benefits.map(benefit => (
                  <div key={benefit} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">
                    <Check className="mb-2 h-4 w-4" style={{ color: config.primaryColor }} />
                    {benefit}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-black text-slate-950">
              <CreditCard className="h-5 w-5" style={{ color: config.primaryColor }} />
              Dados de pagamento
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {['Nome completo', 'E-mail', 'CPF/CNPJ', 'Telefone', 'Número do cartão', 'Validade e CVV'].map(label => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-black uppercase text-slate-400">{label}</p>
                  <div className="mt-2 h-4 rounded bg-slate-200/70" />
                </div>
              ))}
            </div>
          </section>

          {orderBumpEnabled && (
            <section className="rounded-3xl border-2 border-dashed bg-white p-5 shadow-sm" style={{ borderColor: config.primaryColor }}>
              <div className="flex gap-4">
                {config.orderBumpImageUrl && <img src={config.orderBumpImageUrl} alt="Order bump" className="h-24 w-24 rounded-2xl object-cover" />}
                <div>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-[11px] font-black uppercase text-red-600">Oferta especial</span>
                  <p className="mt-3 text-base font-black text-slate-950">{product.order_bump_title || 'Adicionar ao pedido'}</p>
                  <p className="mt-1 text-sm text-slate-500">{product.order_bump_description || 'Adicione este bônus ao pedido.'}</p>
                  <p className="mt-2 text-lg font-black" style={{ color: config.primaryColor }}>+ R$ {bumpPrice.toFixed(2).replace('.', ',')}</p>
                </div>
              </div>
            </section>
          )}
        </main>

        <aside>
          <div className="sticky top-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
            <h2 className="text-lg font-black text-slate-950">Resumo do pedido</h2>
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              {config.mockupImageUrl && <img src={config.mockupImageUrl} alt={product.name} className="h-14 w-14 rounded-xl object-cover" />}
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">{product.name}</p>
                <p className="text-xs font-semibold text-slate-500">{plan?.name || 'Acesso completo'}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3 border-b border-slate-100 pb-5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><strong>R$ {price.toFixed(2).replace('.', ',')}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Taxa Flowyn</span><strong>R$ 0,00</strong></div>
              <div className="flex justify-between text-lg"><span className="font-black text-slate-950">Total</span><strong>R$ {price.toFixed(2).replace('.', ',')}</strong></div>
            </div>
            <button style={{ backgroundColor: config.primaryColor }} className="mt-6 w-full rounded-2xl px-5 py-4 text-sm font-black text-black shadow-lg">
              {config.buttonText}
            </button>
            <p className="mt-4 text-center text-xs font-bold text-slate-400">{config.securityText}</p>
            {config.blocks.guarantee && (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">{config.guaranteeText}</div>
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
