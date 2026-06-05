'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { BookOpen, Check, ChevronLeft, ChevronRight, FileText, Layers, Plus, ToggleLeft, ToggleRight, Trash2, Users } from 'lucide-react'
import { FileUpload } from '@/components/FileUpload'

const PRODUCT_TYPES = [
  { value: 'course', label: 'Curso Online', icon: BookOpen, desc: 'Videoaulas hospedadas na Flowyn com area de membros' },
  { value: 'ebook', label: 'E-book / PDF', icon: FileText, desc: 'Material digital entregue por download apos a compra' },
  { value: 'mentoria', label: 'Mentoria / Coaching', icon: Users, desc: 'Atendimento ao vivo, grupo ou 1-a-1' },
  { value: 'outros', label: 'Outros Infoprodutos', icon: Layers, desc: 'Templates, planilhas, podcasts e mais' },
]

const CATEGORIES = [
  'Marketing & Negocios', 'Financas & Investimentos', 'Saude & Bem-estar',
  'Educacao', 'Tecnologia', 'Beleza & Moda', 'Esportes & Fitness',
  'Culinaria', 'Arte & Design', 'Outros',
]

interface Plan { name: string; price: string; billing_type: 'one_time' }
interface WizardData {
  product_type: string
  name: string
  short_description: string
  description: string
  category: string
  cover_url: string
  logo_url: string
  checkout_banner_url: string
  checkout_video_url: string
  plans: Plan[]
  order_bump_enabled: boolean
  order_bump_title: string
  order_bump_description: string
  order_bump_price: string
  order_bump_discount_percent: string
  order_bump_image_url: string
  delivery_type: string
  delivery_url: string
  deliverable_file_paths: string[]
  order_bump_file_paths: string[]
  is_public: boolean
}

const INITIAL: WizardData = {
  product_type: '',
  name: '',
  short_description: '',
  description: '',
  category: '',
  cover_url: '',
  logo_url: '',
  checkout_banner_url: '',
  checkout_video_url: '',
  plans: [{ name: 'Acesso Completo', price: '', billing_type: 'one_time' }],
  order_bump_enabled: false,
  order_bump_title: '',
  order_bump_description: '',
  order_bump_price: '',
  order_bump_discount_percent: '',
  order_bump_image_url: '',
  delivery_type: 'external',
  delivery_url: '',
  deliverable_file_paths: [],
  order_bump_file_paths: [],
  is_public: false,
}

const inputClass = 'w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] transition-all outline-none'
const labelClass = 'block text-sm font-semibold text-white/70 mb-2'

export function ProductWizard({
  createProductAction,
  userId,
}: {
  createProductAction: (data: WizardData) => Promise<void | { error: string }>
  userId: string
}) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof WizardData, value: any) => setData(d => ({ ...d, [key]: value }))
  const addPlan = () => set('plans', [...data.plans, { name: '', price: '', billing_type: 'one_time' }])
  const removePlan = (i: number) => set('plans', data.plans.filter((_, idx) => idx !== i))
  const updatePlan = (i: number, field: keyof Plan, value: string) =>
    set('plans', data.plans.map((p, idx) => idx === i ? { ...p, [field]: value } : p))

  const canNext = () => {
    if (step === 1) return !!data.product_type
    if (step === 2) return !!data.name && !!data.short_description && !!data.category
    if (step === 4) return data.plans.length > 0 && data.plans.every(p => p.name && p.price)
    return true
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await createProductAction(data)
      if (result && 'error' in result) {
        setError(result.error)
        setLoading(false)
      }
    } catch (err: any) {
      console.error('[Wizard] Erro inesperado:', err)
      setError(err?.message || 'Erro inesperado. Verifique o console.')
      setLoading(false)
    }
  }

  const steps = ['Tipo', 'Detalhes', 'Checkout', 'Precos', 'Entrega']
  const isDigitalFile = ['ebook', 'outros'].includes(data.product_type)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-10 flex items-center justify-between">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${i + 1 < step ? 'bg-[#00e88a] text-black' : i + 1 === step ? 'border border-[#00e88a] bg-[#00e88a]/20 text-[#00e88a]' : 'bg-white/5 text-white/30'}`}>
              {i + 1 < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`hidden text-sm font-medium sm:block ${i + 1 === step ? 'text-white' : 'text-white/30'}`}>{s}</span>
            {i < steps.length - 1 && <div className="mx-1 h-px w-8 bg-white/10" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <h2 className="mb-2 text-2xl font-extrabold text-white">O que voce vai vender?</h2>
          <p className="mb-8 text-sm text-white/50">Escolha o tipo de produto que deseja criar.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PRODUCT_TYPES.map(t => {
              const Icon = t.icon
              const active = data.product_type === t.value
              return (
                <button key={t.value} type="button" onClick={() => set('product_type', t.value)} className={`rounded-2xl border p-5 text-left transition-all ${active ? 'border-[#00e88a] bg-[#00e88a]/5' : 'border-white/10 bg-[#111111] hover:border-white/20'}`}>
                  <Icon className={`mb-3 h-7 w-7 ${active ? 'text-[#00e88a]' : 'text-white/40'}`} />
                  <h3 className={`mb-1 font-bold ${active ? 'text-[#00e88a]' : 'text-white'}`}>{t.label}</h3>
                  <p className="text-xs text-white/50">{t.desc}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <h2 className="mb-2 text-2xl font-extrabold text-white">Informacoes do produto</h2>
          <p className="mb-6 text-sm text-white/50">Estes dados aparecem no checkout e na area do aluno.</p>
          <Field label="Nome do Produto *"><input className={inputClass} placeholder="Ex: Curso de Marketing Digital" value={data.name} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Descricao Curta *"><input className={inputClass} placeholder="Uma frase que resume o produto" value={data.short_description} onChange={e => set('short_description', e.target.value)} /></Field>
          <Field label="Descricao Completa"><textarea className={`${inputClass} resize-none`} rows={4} placeholder="Descreva o produto em detalhes." value={data.description} onChange={e => set('description', e.target.value)} /></Field>
          <Field label="Categoria *">
            <select className={inputClass} value={data.category} onChange={e => set('category', e.target.value)}>
              <option value="">Selecione uma categoria...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <FileUpload mode="image" label="Imagem de Capa *" hint="JPG, PNG ou WebP" userId={userId} folder="covers" currentUrl={data.cover_url} onUpload={(url) => set('cover_url', url)} onRemove={() => set('cover_url', '')} />
            <FileUpload mode="image" label="Logo / Thumbnail" hint="Imagem quadrada recomendada" userId={userId} folder="logos" currentUrl={data.logo_url} onUpload={(url) => set('logo_url', url)} onRemove={() => set('logo_url', '')} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <h2 className="mb-2 text-2xl font-extrabold text-white">Aparencia do Checkout</h2>
          <p className="mb-6 text-sm text-white/50">Personalize como seu checkout vai aparecer para os compradores.</p>
          <FileUpload mode="image" label="Banner do Checkout" hint="Imagem horizontal para o topo do checkout" userId={userId} folder="banners" currentUrl={data.checkout_banner_url} onUpload={(url) => set('checkout_banner_url', url)} onRemove={() => set('checkout_banner_url', '')} />
          <Field label="Video de Vendas (YouTube / Vimeo)">
            <input className={inputClass} type="url" placeholder="https://youtube.com/watch?v=..." value={data.checkout_video_url} onChange={e => set('checkout_video_url', e.target.value)} />
          </Field>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <h2 className="mb-2 text-2xl font-extrabold text-white">Precos & Order Bump</h2>
          <p className="mb-2 text-sm text-white/50">Configure os planos de preco e, opcionalmente, um order bump.</p>

          <div className="space-y-3">
            {data.plans.map((plan, i) => (
              <div key={i} className="space-y-3 rounded-2xl border border-white/10 bg-[#111111] p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Plano {i + 1}</span>
                  {data.plans.length > 1 && (
                    <button type="button" onClick={() => removePlan(i)} className="text-red-400/60 transition-colors hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome do Plano"><input className={inputClass} placeholder="Ex: Acesso Completo" value={plan.name} onChange={e => updatePlan(i, 'name', e.target.value)} /></Field>
                  <Field label="Preco (R$)"><input className={inputClass} type="number" min="0" step="0.01" placeholder="97.00" value={plan.price} onChange={e => updatePlan(i, 'price', e.target.value)} /></Field>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-semibold text-white/60">Pagamento unico</div>
              </div>
            ))}
            <button type="button" onClick={addPlan} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 py-3 text-sm font-medium text-white/50 transition-all hover:border-[#00e88a]/40 hover:text-[#00e88a]">
              <Plus className="h-4 w-4" /> Adicionar outro plano
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#111111] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Order Bump</h3>
                <p className="mt-0.5 text-xs text-white/50">Oferta adicional exibida no checkout</p>
              </div>
              <button type="button" onClick={() => set('order_bump_enabled', !data.order_bump_enabled)} className="text-[#00e88a]">
                {data.order_bump_enabled ? <ToggleRight className="h-8 w-8" /> : <ToggleLeft className="h-8 w-8 text-white/30" />}
              </button>
            </div>
            {data.order_bump_enabled && (
              <div className="space-y-3 border-t border-white/10 pt-3">
                <Field label="Titulo do Order Bump"><input className={inputClass} placeholder="Ex: Planilha bonus por apenas R$ 9,90" value={data.order_bump_title} onChange={e => set('order_bump_title', e.target.value)} /></Field>
                <Field label="Descricao"><input className={inputClass} placeholder="Descreva o que e oferecido" value={data.order_bump_description} onChange={e => set('order_bump_description', e.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Preco (R$)"><input className={inputClass} type="number" min="0" step="0.01" placeholder="9.90" value={data.order_bump_price} onChange={e => set('order_bump_price', e.target.value)} /></Field>
                  <Field label="Desconto (%)"><input className={inputClass} type="number" min="0" max="100" placeholder="50" value={data.order_bump_discount_percent} onChange={e => set('order_bump_discount_percent', e.target.value)} /></Field>
                </div>
                <FileUpload mode="image" label="Imagem do Order Bump" hint="Imagem que aparecera na oferta" userId={userId} folder="order_bumps" currentUrl={data.order_bump_image_url} onUpload={(url) => set('order_bump_image_url', url)} onRemove={() => set('order_bump_image_url', '')} />
              </div>
            )}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-5">
          <h2 className="mb-2 text-2xl font-extrabold text-white">Entrega do produto</h2>
          <p className="mb-6 text-sm text-white/50">Configure como o comprador recebera acesso depois do pagamento.</p>

          <div>
            <label className={labelClass}>Tipo de Entrega</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => set('delivery_type', 'platform')} className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-all ${data.delivery_type === 'platform' ? 'border-[#00e88a] bg-[#00e88a]/10 text-[#00e88a]' : 'border-white/10 text-white/50 hover:border-white/20'}`}>
                Area de Membros Flowyn
              </button>
              <button type="button" onClick={() => set('delivery_type', 'external')} className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-all ${data.delivery_type === 'external' ? 'border-[#00e88a] bg-[#00e88a]/10 text-[#00e88a]' : 'border-white/10 text-white/50 hover:border-white/20'}`}>
                Entrega Digital
              </button>
            </div>
          </div>

          {data.delivery_type === 'external' && (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-[#111111] p-5">
              <h3 className="mb-1 text-sm font-bold text-white">Arquivo Entregavel</h3>
              <p className="mb-3 text-xs text-white/40">Faca upload do arquivo enviado ao comprador ou informe um link externo.</p>
              {!data.delivery_url && (
                <FileUpload mode="file" label={isDigitalFile ? 'Fazer upload dos arquivos' : 'Arquivos entregaveis'} hint="PDF, ZIP ou EPUB" userId={userId} folder="deliverables" multiple currentUrls={data.deliverable_file_paths} onUpload={(paths) => set('deliverable_file_paths', paths)} onRemove={(index) => {
                  if (index !== undefined) {
                    const newPaths = [...data.deliverable_file_paths]
                    newPaths.splice(index, 1)
                    set('deliverable_file_paths', newPaths)
                  }
                }} />
              )}
              {data.deliverable_file_paths.length === 0 && (
                <Field label="Link externo de acesso">
                  <input className={inputClass} type="url" placeholder="https://drive.google.com/..." value={data.delivery_url} onChange={e => set('delivery_url', e.target.value)} />
                </Field>
              )}
            </div>
          )}

          {data.delivery_type === 'platform' && (
            <div className="rounded-xl border border-[#00e88a]/20 bg-[#00e88a]/5 p-4">
              <p className="text-sm font-medium text-[#00e88a]">Apos criar o produto, voce podera adicionar modulos e aulas na area de membros.</p>
            </div>
          )}

          <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/60">Resumo do Produto</h3>
            <Summary label="Nome" value={data.name || '-'} />
            <Summary label="Tipo" value={PRODUCT_TYPES.find(t => t.value === data.product_type)?.label || '-'} />
            <Summary label="Planos" value={`${data.plans.length} plano(s)`} />
            <Summary label="Entrega" value={data.delivery_type === 'platform' ? 'Area de membros' : data.deliverable_file_paths.length > 0 ? `${data.deliverable_file_paths.length} arquivo(s)` : data.delivery_url ? 'Link externo' : '-'} />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-bold text-red-400">Erro ao publicar produto</p>
          <p className="mt-1 text-xs text-red-300/80">{error}</p>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between border-t border-white/10 pt-6">
        <button type="button" onClick={() => step > 1 ? setStep(s => s - 1) : null} className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all ${step > 1 ? 'border-white/10 text-white/70 hover:bg-white/5 hover:text-white' : 'invisible'}`}>
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>
        {step < 5 ? (
          <button type="button" onClick={() => canNext() && setStep(s => s + 1)} className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all ${canNext() ? 'bg-[#00e88a] text-black shadow-[0_0_15px_rgba(0,232,138,0.2)] hover:bg-[#00e88a]/90' : 'cursor-not-allowed bg-white/10 text-white/30'}`}>
            Proximo <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 rounded-xl bg-[#00e88a] px-8 py-2.5 text-sm font-bold text-black shadow-[0_0_20px_rgba(0,232,138,0.3)] transition-all hover:bg-[#00e88a]/90 disabled:opacity-50">
            {loading ? 'Criando...' : 'Publicar Produto'}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-white/50">{label}</span>
      <span className="ml-4 truncate font-semibold text-white">{value}</span>
    </div>
  )
}
