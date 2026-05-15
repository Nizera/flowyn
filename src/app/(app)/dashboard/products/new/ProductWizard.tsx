'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen, FileText, Users, Layers, ChevronRight, ChevronLeft,
  Check, Plus, Trash2, ToggleLeft, ToggleRight
} from 'lucide-react'
import { FileUpload } from '@/components/FileUpload'

const PRODUCT_TYPES = [
  { value: 'course', label: 'Curso Online', icon: BookOpen, desc: 'Videoaulas hospedadas na Flowyn com área de membros' },
  { value: 'ebook', label: 'E-book / PDF', icon: FileText, desc: 'Material digital entregue por download após a compra' },
  { value: 'mentoria', label: 'Mentoria / Coaching', icon: Users, desc: 'Atendimento ao vivo, grupo ou 1-a-1' },
  { value: 'outros', label: 'Outros Infoprodutos', icon: Layers, desc: 'Templates, planilhas, podcasts e mais' },
]

const CATEGORIES = [
  'Marketing & Negócios', 'Finanças & Investimentos', 'Saúde & Bem-estar',
  'Educação', 'Tecnologia', 'Beleza & Moda', 'Esportes & Fitness',
  'Culinária', 'Arte & Design', 'Outros',
]

interface Plan { name: string; price: string; billing_type: 'one_time' | 'recurring' }
interface WizardData {
  product_type: string
  name: string
  short_description: string
  description: string
  category: string
  cover_url: string
  logo_url: string
  site_url: string
  checkout_banner_url: string
  checkout_video_url: string
  plans: Plan[]
  order_bump_enabled: boolean
  order_bump_title: string
  order_bump_description: string
  order_bump_price: string
  order_bump_discount_percent: string
  order_bump_image_url: string
  commission_rate: string
  delivery_type: string
  delivery_url: string
  deliverable_file_paths: string[]
  order_bump_file_paths: string[]
  is_public: boolean
}

const INITIAL: WizardData = {
  product_type: '',
  name: '', short_description: '', description: '', category: '', cover_url: '', logo_url: '',
  site_url: '', checkout_banner_url: '', checkout_video_url: '',
  plans: [{ name: 'Acesso Completo', price: '', billing_type: 'one_time' }],
  order_bump_enabled: false, order_bump_title: '', order_bump_description: '',
  order_bump_price: '', order_bump_discount_percent: '', order_bump_image_url: '',
  commission_rate: '40', delivery_type: 'external', delivery_url: '',
  deliverable_file_paths: [], order_bump_file_paths: [], is_public: true,
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
  const router = useRouter()

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
      if (result != null && 'error' in (result as object)) {
        setError((result as { error: string }).error)
        setLoading(false)
      }
      // on success, createProductAction calls redirect() so we never reach here
    } catch (err: any) {
      console.error('[Wizard] Erro inesperado:', err)
      setError(err?.message || 'Erro inesperado. Verifique o console.')
      setLoading(false)
    }
  }

  const steps = ['Tipo', 'Detalhes', 'Checkout', 'Preços', 'Publicar']
  const isDigitalFile = ['ebook', 'outros'].includes(data.product_type)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-10">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i + 1 < step ? 'bg-[#00e88a] text-black' : i + 1 === step ? 'bg-[#00e88a]/20 text-[#00e88a] border border-[#00e88a]' : 'bg-white/5 text-white/30'}`}>
              {i + 1 < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-sm font-medium hidden sm:block ${i + 1 === step ? 'text-white' : 'text-white/30'}`}>{s}</span>
            {i < steps.length - 1 && <div className="w-8 h-px bg-white/10 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1: Tipo */}
      {step === 1 && (
        <div>
          <h2 className="text-2xl font-extrabold text-white mb-2">O que você vai vender?</h2>
          <p className="text-white/50 text-sm mb-8">Escolha o tipo de produto que deseja criar.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PRODUCT_TYPES.map(t => {
              const Icon = t.icon
              const active = data.product_type === t.value
              return (
                <button key={t.value} type="button" onClick={() => set('product_type', t.value)}
                  className={`p-5 rounded-2xl border text-left transition-all ${active ? 'border-[#00e88a] bg-[#00e88a]/5' : 'border-white/10 bg-[#111111] hover:border-white/20'}`}>
                  <Icon className={`w-7 h-7 mb-3 ${active ? 'text-[#00e88a]' : 'text-white/40'}`} />
                  <h3 className={`font-bold mb-1 ${active ? 'text-[#00e88a]' : 'text-white'}`}>{t.label}</h3>
                  <p className="text-xs text-white/50">{t.desc}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 2: Detalhes */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-2xl font-extrabold text-white mb-2">Informações do produto</h2>
          <p className="text-white/50 text-sm mb-6">Estes dados aparecem na vitrine e no checkout.</p>
          <div>
            <label className={labelClass}>Nome do Produto <span className="text-[#00e88a]">*</span></label>
            <input className={inputClass} placeholder="Ex: Curso de Marketing Digital Avançado" value={data.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Descrição Curta <span className="text-[#00e88a]">*</span></label>
            <input className={inputClass} placeholder="Uma frase que resume o produto" value={data.short_description} onChange={e => set('short_description', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Descrição Completa</label>
            <textarea className={`${inputClass} resize-none`} rows={4} placeholder="Descreva o produto em detalhes: o que o aluno vai aprender, pré-requisitos, bônus..." value={data.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Categoria <span className="text-[#00e88a]">*</span></label>
            <select className={inputClass} value={data.category} onChange={e => set('category', e.target.value)}>
              <option value="">Selecione uma categoria...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {/* Upload de imagens */}
          <div className="grid grid-cols-2 gap-4">
            <FileUpload
              mode="image"
              label="Imagem de Capa *"
              hint="JPG, PNG ou WebP — 1200×675px recomendado"
              userId={userId}
              folder="covers"
              currentUrl={data.cover_url}
              onUpload={(url) => set('cover_url', url)}
              onRemove={() => set('cover_url', '')}
            />
            <FileUpload
              mode="image"
              label="Logo / Thumbnail"
              hint="Quadrado — 400×400px recomendado"
              userId={userId}
              folder="logos"
              currentUrl={data.logo_url}
              onUpload={(url) => set('logo_url', url)}
              onRemove={() => set('logo_url', '')}
            />
          </div>
        </div>
      )}

      {/* Step 3: Checkout Design */}
      {step === 3 && (
        <div className="space-y-5">
          <h2 className="text-2xl font-extrabold text-white mb-2">Aparência do Checkout</h2>
          <p className="text-white/50 text-sm mb-6">Personalize como seu checkout vai aparecer para os compradores.</p>
          <div>
            <label className={labelClass}>Página de Vendas (URL externa)</label>
            <input className={inputClass} type="url" placeholder="https://suapagina.com" value={data.site_url} onChange={e => set('site_url', e.target.value)} />
            <p className="text-xs text-white/40 mt-1">Link para sua landing page ou página de vendas</p>
          </div>
          <FileUpload
            mode="image"
            label="Banner do Checkout"
            hint="1200×400px recomendado — exibido no topo do checkout"
            userId={userId}
            folder="banners"
            currentUrl={data.checkout_banner_url}
            onUpload={(url) => set('checkout_banner_url', url)}
            onRemove={() => set('checkout_banner_url', '')}
          />
          <div>
            <label className={labelClass}>Vídeo de Vendas (YouTube / Vimeo)</label>
            <input className={inputClass} type="url" placeholder="https://youtube.com/watch?v=..." value={data.checkout_video_url} onChange={e => set('checkout_video_url', e.target.value)} />
            <p className="text-xs text-white/40 mt-1">Exibido no checkout para aumentar conversão</p>
          </div>
        </div>
      )}

      {/* Step 4: Preços */}
      {step === 4 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-extrabold text-white mb-2">Preços & Order Bump</h2>
          <p className="text-white/50 text-sm mb-2">Configure os planos de preço e, opcionalmente, um order bump.</p>

          {/* Plans */}
          <div className="space-y-3">
            {data.plans.map((plan, i) => (
              <div key={i} className="bg-[#111111] border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">Plano {i + 1}</span>
                  {data.plans.length > 1 && (
                    <button type="button" onClick={() => removePlan(i)} className="text-red-400/60 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Nome do Plano</label>
                    <input className={inputClass} placeholder="Ex: Acesso Completo" value={plan.name} onChange={e => updatePlan(i, 'name', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Preço (R$)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-bold">R$</span>
                      <input className={`${inputClass} pl-10`} type="number" min="0" step="0.01" placeholder="97.00" value={plan.price} onChange={e => updatePlan(i, 'price', e.target.value)} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Tipo de Cobrança</label>
                  <div className="flex gap-3">
                    {['one_time', 'recurring'].map(bt => (
                      <button key={bt} type="button" onClick={() => updatePlan(i, 'billing_type', bt as any)}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${plan.billing_type === bt ? 'border-[#00e88a] bg-[#00e88a]/10 text-[#00e88a]' : 'border-white/10 text-white/50 hover:border-white/20'}`}>
                        {bt === 'one_time' ? '💳 Pagamento Único' : '🔄 Assinatura Mensal'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addPlan} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/20 rounded-2xl text-white/50 hover:border-[#00e88a]/40 hover:text-[#00e88a] transition-all text-sm font-medium">
              <Plus className="w-4 h-4" /> Adicionar outro plano
            </button>
          </div>

          {/* Order Bump */}
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-white text-sm">Order Bump</h3>
                <p className="text-xs text-white/50 mt-0.5">Oferta adicional exibida no checkout</p>
              </div>
              <button type="button" onClick={() => set('order_bump_enabled', !data.order_bump_enabled)} className="text-[#00e88a]">
                {data.order_bump_enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-white/30" />}
              </button>
            </div>
            {data.order_bump_enabled && (
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div>
                  <label className={labelClass}>Título do Order Bump</label>
                  <input className={inputClass} placeholder="Ex: Planilha Bônus por apenas R$ 9,90" value={data.order_bump_title} onChange={e => set('order_bump_title', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Descrição</label>
                  <input className={inputClass} placeholder="Descreva o que é oferecido" value={data.order_bump_description} onChange={e => set('order_bump_description', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Preço (R$)</label>
                    <input className={inputClass} type="number" min="0" step="0.01" placeholder="9.90" value={data.order_bump_price} onChange={e => set('order_bump_price', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Desconto (%)</label>
                    <input className={inputClass} type="number" min="0" max="100" placeholder="50" value={data.order_bump_discount_percent} onChange={e => set('order_bump_discount_percent', e.target.value)} />
                  </div>
                </div>
                <div>
                  <FileUpload
                    mode="image"
                    label="Imagem do Order Bump (Opcional)"
                    hint="Imagem que aparecerá na oferta (ex: capa do e-book ou mockups)"
                    userId={userId}
                    folder="order_bumps"
                    currentUrl={data.order_bump_image_url}
                    onUpload={(url) => set('order_bump_image_url', url)}
                    onRemove={() => set('order_bump_image_url', '')}
                  />
                </div>
                {data.delivery_type === 'external' && !data.delivery_url && (
                  <div className="pt-3">
                    <FileUpload
                      mode="file"
                      label="Arquivos do Order Bump"
                      hint="PDF, ZIP ou EPUB — máx. 100MB. Serão enviados caso o cliente adicione a oferta."
                      userId={userId}
                      folder="order_bumps"
                      multiple={true}
                      currentUrls={data.order_bump_file_paths}
                      onUpload={(paths) => set('order_bump_file_paths', paths)}
                      onRemove={(index) => {
                        if (index !== undefined) {
                          const newPaths = [...data.order_bump_file_paths]
                          newPaths.splice(index, 1)
                          set('order_bump_file_paths', newPaths)
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 5: Publicar */}
      {step === 5 && (
        <div className="space-y-5">
          <h2 className="text-2xl font-extrabold text-white mb-2">Afiliação & Entrega</h2>
          <p className="text-white/50 text-sm mb-6">Configure como o produto será entregue e como outros podem promovê-lo.</p>

          <div>
            <label className={labelClass}>Comissão para Afiliados (%)</label>
            <div className="relative max-w-xs">
              <input className={`${inputClass} pr-10 text-lg font-bold`} type="number" min="0" max="90" step="1" value={data.commission_rate} onChange={e => set('commission_rate', e.target.value)} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">%</span>
            </div>
            <p className="text-xs text-white/40 mt-2">Plataformas como Hotmart recomendam 30–50%. Comissões altas atraem mais afiliados.</p>
          </div>

          {/* Delivery type */}
          <div>
            <label className={labelClass}>Tipo de Entrega</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => set('delivery_type', 'platform')}
                className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${data.delivery_type === 'platform' ? 'border-[#00e88a] bg-[#00e88a]/10 text-[#00e88a]' : 'border-white/10 text-white/50 hover:border-white/20'}`}>
                🎓 Área de Membros Flowyn
              </button>
              <button type="button" onClick={() => set('delivery_type', 'external')}
                className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${data.delivery_type === 'external' ? 'border-[#00e88a] bg-[#00e88a]/10 text-[#00e88a]' : 'border-white/10 text-white/50 hover:border-white/20'}`}>
                📦 Entrega Digital
              </button>
            </div>
          </div>

          {/* Entrega digital: upload OU link */}
          {data.delivery_type === 'external' && (
            <div className="bg-[#111111] border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-white text-sm mb-1">📦 Arquivo Entregável</h3>
              <p className="text-xs text-white/40 mb-3">
                Faça upload do arquivo que será enviado ao comprador por e-mail após o pagamento.
                Ou, se preferir, informe um link externo.
              </p>

              {/* Upload do entregável */}
              {!data.delivery_url && (
                <FileUpload
                  mode="file"
                  label={isDigitalFile ? 'Fazer upload dos arquivos (PDF, ZIP, EPUB)' : 'Arquivos entregáveis (opcional)'}
                  hint="PDF, ZIP ou EPUB — máx. 100MB. Links enviados por e-mail."
                  userId={userId}
                  folder="deliverables"
                  multiple={true}
                  currentUrls={data.deliverable_file_paths}
                  onUpload={(paths) => set('deliverable_file_paths', paths)}
                  onRemove={(index) => {
                    if (index !== undefined) {
                      const newPaths = [...data.deliverable_file_paths]
                      newPaths.splice(index, 1)
                      set('deliverable_file_paths', newPaths)
                    }
                  }}
                />
              )}

              {/* Separador OU */}
              {data.deliverable_file_paths.length === 0 && (
                <>
                  {!data.delivery_url && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-xs text-white/30 font-medium">ou</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>
                  )}
                  <div>
                    <label className={labelClass}>Link externo de acesso</label>
                    <input
                      className={inputClass}
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={data.delivery_url}
                      onChange={e => set('delivery_url', e.target.value)}
                    />
                    <p className="text-xs text-white/40 mt-1">URL enviada ao comprador por e-mail após confirmação do pagamento</p>
                  </div>
                </>
              )}

              {data.deliverable_file_paths.length > 0 && (
                <div className="bg-[#00e88a]/5 border border-[#00e88a]/20 rounded-xl p-3">
                  <p className="text-sm text-[#00e88a] font-medium">
                    ✅ {data.deliverable_file_paths.length} arquivo(s) salvo(s)! Serão enviados por e-mail com link de download de 48h após a compra.
                  </p>
                </div>
              )}
            </div>
          )}

          {data.delivery_type === 'platform' && (
            <div className="bg-[#00e88a]/5 border border-[#00e88a]/20 rounded-xl p-4">
              <p className="text-sm text-[#00e88a] font-medium">✅ Após criar o produto, você poderá adicionar módulos e aulas na área de membros.</p>
            </div>
          )}

          {/* Visibilidade */}
          <div className="flex items-center justify-between bg-[#111111] border border-white/10 rounded-2xl p-5">
            <div>
              <h3 className="font-bold text-white text-sm">Visível na Vitrine</h3>
              <p className="text-xs text-white/50 mt-0.5">Outros usuários poderão encontrar e se afiliar ao seu produto</p>
            </div>
            <button type="button" onClick={() => set('is_public', !data.is_public)} className="text-[#00e88a]">
              {data.is_public ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-white/30" />}
            </button>
          </div>

          {/* Resumo */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Resumo do Produto</h3>
            <div className="flex justify-between text-sm"><span className="text-white/50">Nome</span><span className="text-white font-semibold truncate ml-4">{data.name}</span></div>
            <div className="flex justify-between text-sm"><span className="text-white/50">Tipo</span><span className="text-white font-semibold">{PRODUCT_TYPES.find(t => t.value === data.product_type)?.label}</span></div>
            <div className="flex justify-between text-sm"><span className="text-white/50">Planos</span><span className="text-white font-semibold">{data.plans.length} plano(s)</span></div>
            <div className="flex justify-between text-sm"><span className="text-white/50">Comissão</span><span className="text-[#00e88a] font-bold">{data.commission_rate}%</span></div>
            <div className="flex justify-between text-sm"><span className="text-white/50">Entrega</span><span className="text-white font-semibold">{data.deliverable_file_paths.length > 0 ? `📁 ${data.deliverable_file_paths.length} Arquivo(s) enviado(s)` : data.delivery_url ? '🔗 Link externo' : data.delivery_type === 'platform' ? '🎓 Área de membros' : '—'}</span></div>
            <div className="flex justify-between text-sm"><span className="text-white/50">Visibilidade</span><span className="text-white font-semibold">{data.is_public ? 'Público' : 'Privado'}</span></div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 14, padding: '14px 18px', marginTop: 24,
          display: 'flex', alignItems: 'flex-start', gap: 12
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', margin: '0 0 2px' }}>Erro ao publicar produto</p>
            <p style={{ fontSize: 12, color: 'rgba(239,68,68,0.8)', margin: 0 }}>{error}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/10">
        <button type="button" onClick={() => step > 1 ? setStep(s => s - 1) : null}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border font-semibold text-sm transition-all ${step > 1 ? 'border-white/10 text-white/70 hover:bg-white/5 hover:text-white' : 'invisible'}`}>
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        {step < 5 ? (
          <button type="button" onClick={() => canNext() && setStep(s => s + 1)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${canNext() ? 'bg-[#00e88a] text-black hover:bg-[#00e88a]/90 shadow-[0_0_15px_rgba(0,232,138,0.2)]' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}>
            Próximo <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-sm bg-[#00e88a] text-black hover:bg-[#00e88a]/90 shadow-[0_0_20px_rgba(0,232,138,0.3)] transition-all disabled:opacity-50">
            {loading ? 'Criando...' : '🚀 Publicar Produto'}
          </button>
        )}
      </div>
    </div>
  )
}
