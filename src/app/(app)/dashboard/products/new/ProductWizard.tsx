'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

const PRODUCT_TYPES = [
  { value: 'course', label: 'Curso Online' },
  { value: 'ebook', label: 'E-book / PDF' },
  { value: 'mentoria', label: 'Mentoria / Coaching' },
  { value: 'outros', label: 'Outros Infoprodutos' },
]

const CATEGORIES = [
  'Marketing & Negocios',
  'Financas & Investimentos',
  'Saude & Bem-estar',
  'Educacao',
  'Tecnologia',
  'Beleza & Moda',
  'Esportes & Fitness',
  'Culinaria',
  'Arte & Design',
  'Outros',
]

interface Plan {
  name: string
  price: string
  billing_type: 'one_time' | 'recurring'
}

interface ProductDraft {
  product_type: string
  name: string
  category: string
  price: string
  billing_type: 'one_time' | 'recurring'
  short_description: string
}

interface ProductPayload extends ProductDraft {
  description: string
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

const INITIAL: ProductDraft = {
  product_type: '',
  name: '',
  category: '',
  price: '',
  billing_type: 'one_time',
  short_description: '',
}

const fieldClass = 'h-12 w-full rounded-xl border-0 bg-surface px-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted focus:bg-card focus:ring-2 focus:ring-orange-500/20'
const textareaClass = 'min-h-28 w-full resize-none rounded-xl border-0 bg-surface px-4 py-3 text-sm font-medium leading-6 text-foreground outline-none transition placeholder:text-muted focus:bg-card focus:ring-2 focus:ring-orange-500/20'

export function ProductWizard({
  createProductAction,
}: {
  createProductAction: (data: ProductPayload) => Promise<{ productId: string } | { error: string }>
  userId: string
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<ProductDraft>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const missingFields = useMemo(() => {
    const fields: string[] = []
    if (!draft.name.trim()) fields.push('nome do produto')
    if (!draft.product_type) fields.push('tipo de produto')
    if (!draft.category) fields.push('categoria')
    if (!draft.price || Number(draft.price) < 5) fields.push('preco inicial (minimo R$ 5,00)')
    return fields
  }, [draft])

  function update(key: keyof ProductDraft, value: string) {
    setDraft(current => ({ ...current, [key]: value }))
    setError(null)
  }

  function setBillingType(value: 'one_time' | 'recurring') {
    setDraft(current => ({ ...current, billing_type: value }))
    setError(null)
  }

  async function submit() {
    if (missingFields.length > 0) {
      setError(`Preencha: ${missingFields.join(', ')}.`)
      return
    }

    const deliveryType = ['course', 'mentoria'].includes(draft.product_type) ? 'platform' : 'external'
    const shortDescription = draft.short_description.trim() || `Acesse ${draft.name.trim()} pela Flowyn.`
    const payload: ProductPayload = {
      ...draft,
      name: draft.name.trim(),
      short_description: shortDescription,
      description: shortDescription,
      cover_url: '',
      logo_url: '',
      checkout_banner_url: '',
      checkout_video_url: '',
      plans: [{ name: draft.billing_type === 'recurring' ? 'Assinatura Mensal' : 'Acesso Completo', price: draft.price, billing_type: draft.billing_type }],
      order_bump_enabled: false,
      order_bump_title: '',
      order_bump_description: '',
      order_bump_price: '',
      order_bump_discount_percent: '',
      order_bump_image_url: '',
      delivery_type: deliveryType,
      delivery_url: '',
      deliverable_file_paths: [],
      order_bump_file_paths: [],
      is_public: false,
    }

    setLoading(true)
    setError(null)
    try {
      const result = await createProductAction(payload)
      if (result) {
        if ('error' in result) {
          setError(result.error)
          setLoading(false)
          return
        }

        if ('productId' in result) {
          router.push(`/dashboard/products/${result.productId}`)
          return
        }
      }

      setError('Erro inesperado ao criar produto.')
      setLoading(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro inesperado ao criar produto.'
      setError(message)
      setLoading(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-[10px] bg-card px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/dashboard/products" className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600" aria-label="Voltar">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Criar produto</h2>
            <p className="mt-2 text-sm text-muted">Cadastre a oferta principal. Depois voce configura checkout, entrega e conteudo.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Criando...' : 'Criar'}
        </button>
      </div>

      <div className="mt-12 max-w-5xl">
        <div className="grid border-y border-border md:grid-cols-[240px_1fr]">
          <RowTitle title="Produto" description="Nome e formato da oferta." />
          <div className="space-y-5 py-6 md:pl-8">
            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="Nome do produto" required hint="Esse nome sera exibido para os clientes.">
                <input
                  className={fieldClass}
                  value={draft.name}
                  onChange={event => update('name', event.target.value)}
                  placeholder="Nome do produto"
                />
              </Field>

              <Field label="Tipo de produto" required hint="Define os recursos liberados depois da venda.">
                <select className={fieldClass} value={draft.product_type} onChange={event => update('product_type', event.target.value)}>
                  <option value="">Selecione o tipo de produto</option>
                  {PRODUCT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Categoria do produto" required>
              <select className={fieldClass} value={draft.category} onChange={event => update('category', event.target.value)}>
                <option value="">Selecione a categoria do produto</option>
                {CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="grid border-b border-border md:grid-cols-[240px_1fr]">
          <RowTitle title="Preco" description="Valor e forma de cobranca." />
          <div className="space-y-5 py-6 md:pl-8">
            <div className="flex max-w-md rounded-xl bg-surface p-1">
              <button
                type="button"
                onClick={() => setBillingType('one_time')}
                className={`h-10 flex-1 rounded-lg text-sm font-semibold transition ${draft.billing_type === 'one_time' ? 'bg-card text-orange-600 shadow-sm' : 'text-muted hover:text-foreground'}`}
              >
                Preco unico
              </button>
              <button
                type="button"
                onClick={() => setBillingType('recurring')}
                className={`h-10 flex-1 rounded-lg text-sm font-semibold transition ${draft.billing_type === 'recurring' ? 'bg-card text-orange-600 shadow-sm' : 'text-muted hover:text-foreground'}`}
              >
                Recorrente mensal
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label={draft.billing_type === 'recurring' ? 'Valor mensal' : 'Preco inicial'} required hint={draft.billing_type === 'recurring' ? 'Cobrado todo mes enquanto a assinatura estiver ativa.' : 'Voce pode ajustar planos e ofertas dentro do produto.'}>
                <input
                  className={`${fieldClass} max-w-sm`}
                  type="number"
                  min="5"
                  step="0.01"
                  value={draft.price}
                  onChange={event => update('price', event.target.value)}
                  placeholder="R$ 97,00"
                />
              </Field>
              <span className="pb-4 text-sm font-medium text-muted">
                {draft.billing_type === 'recurring' ? '/ mes' : 'pagamento unico'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid border-b border-border md:grid-cols-[240px_1fr]">
          <RowTitle title="Checkout" description="Primeira mensagem da pagina de pagamento." />
          <div className="py-6 md:pl-8">
            <Field label="Descricao curta">
              <textarea
                className={textareaClass}
                value={draft.short_description}
                onChange={event => update('short_description', event.target.value)}
                placeholder="Uma frase clara sobre o que o cliente vai receber."
              />
            </Field>
          </div>
        </div>
      </div>

        {error && (
          <div className="mt-6 max-w-5xl rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-100">
            {error}
          </div>
        )}

        <div className="mt-8 flex max-w-5xl items-center justify-end gap-3">
          <Link href="/dashboard/products" className="rounded-xl px-4 py-3 text-sm font-medium text-red-500 transition hover:bg-red-50">
            Cancelar
          </Link>
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Criando...' : 'Criar produto'}
          </button>
        </div>
    </section>
  )
}

function RowTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-6 md:pr-8">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
    </div>
  )
}

function Field({
  label,
  required = false,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">
        {label}{required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-2 block text-xs leading-5 text-muted">{hint}</span>}
    </label>
  )
}
