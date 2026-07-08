'use client'

import type { ReactNode } from 'react'
import { useActionState, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Save } from 'lucide-react'
import { FileUpload } from '@/components/FileUpload'
import type { CourseContentFormState } from './form-state'
import { initialCourseContentFormState } from './form-state'

type DigitalDeliveryFormProps = {
  userId: string
  product: {
    delivery_type?: string | null
    delivery_url?: string | null
    deliverable_file_paths?: string[] | null
  }
  updateDigitalDelivery: (state: CourseContentFormState, formData: FormData) => Promise<CourseContentFormState>
}

export function DigitalDeliveryForm({ userId, product, updateDigitalDelivery }: DigitalDeliveryFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [deliveryType, setDeliveryType] = useState(product.delivery_type || 'external')
  const [filePaths, setFilePaths] = useState<string[]>(Array.isArray(product.deliverable_file_paths) ? product.deliverable_file_paths : [])
  const [state, action, pending] = useActionState(updateDigitalDelivery, initialCourseContentFormState)

  useEffect(() => {
    if (state.ok) formRef.current?.querySelector<HTMLInputElement>('input[name="delivery_url"]')?.blur()
  }, [state.ok, state.message])

  const hasContent = deliveryType === 'external'
    ? Boolean(product.delivery_url)
    : filePaths.length > 0 || Boolean(product.delivery_url)

  return (
    <form ref={formRef} action={action} className="max-w-6xl">
      <input type="hidden" name="delivery_type" value={deliveryType} />
      <input type="hidden" name="deliverable_file_paths" value={JSON.stringify(filePaths)} />

      <div className="grid border-y border-slate-200 md:grid-cols-[240px_1fr]">
        <RowTitle title="Modo de entrega" description="O que o comprador recebe apos pagamento aprovado." />
        <div className="py-6 md:pl-8">
          <div className="flex max-w-xl rounded-xl bg-[#f4f4f6] p-1">
            <button type="button" onClick={() => setDeliveryType('external')} className={`h-10 flex-1 rounded-lg text-sm font-semibold transition ${deliveryType === 'external' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
              Link externo
            </button>
            <button type="button" onClick={() => setDeliveryType('platform')} className={`h-10 flex-1 rounded-lg text-sm font-semibold transition ${deliveryType === 'platform' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
              Arquivos Flowyn
            </button>
          </div>
        </div>
      </div>

      <div className="grid border-b border-slate-200 md:grid-cols-[240px_1fr]">
        <RowTitle title="Acesso" description="Link ou arquivos nativos." />
        <div className="space-y-5 py-6 md:pl-8">
          <Field label="Link de acesso" required={deliveryType === 'external'} hint={deliveryType === 'external' ? 'Obrigatorio para entrega por link externo.' : 'Opcional se voce tambem quiser enviar um link junto dos arquivos.'}>
            <input name="delivery_url" type="url" defaultValue={product.delivery_url || ''} className={inputClass} placeholder="https://..." />
          </Field>

          <FileUpload
            mode="file"
            label="Arquivos de entrega"
            hint="PDF, ZIP, EPUB, planilhas ou materiais de apoio. Opcional para link externo."
            userId={userId}
            folder="product-files"
            multiple
            currentUrls={filePaths}
            onUpload={(paths) => setFilePaths(Array.isArray(paths) ? paths : [paths])}
            onRemove={(index) => {
              if (index === undefined) return
              setFilePaths(paths => paths.filter((_, idx) => idx !== index))
            }}
          />
        </div>
      </div>

      <div className="grid border-b border-slate-200 md:grid-cols-[240px_1fr]">
        <RowTitle title="Checklist" description="Status da entrega digital." />
        <div className="grid gap-3 py-6 md:grid-cols-3 md:pl-8">
          <CheckItem done={deliveryType === 'platform' || Boolean(product.delivery_url)}>Modo definido</CheckItem>
          <CheckItem done={deliveryType === 'external' ? Boolean(product.delivery_url) : filePaths.length > 0}>Conteudo preenchido</CheckItem>
          <CheckItem done>Envio automatico</CheckItem>
        </div>
      </div>

      <FormMessage state={state} />

      <div className="mt-8 flex justify-end">
        <button disabled={pending || !hasContent} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Save className="h-4 w-4" />}
          {pending ? 'Salvando...' : 'Salvar entrega'}
        </button>
      </div>
    </form>
  )
}

function RowTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-6 md:pr-8">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  )
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-5 text-slate-400">{hint}</span>}
    </label>
  )
}

function FormMessage({ state }: { state: CourseContentFormState }) {
  if (!state.message) return null
  return (
    <div className={`mt-6 flex items-start gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${state.ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-red-50 text-red-700 ring-red-100'}`}>
      {state.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      {state.message}
    </div>
  )
}

function CheckItem({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <CheckCircle2 className={`h-4 w-4 ${done ? 'text-emerald-600' : 'text-slate-300'}`} />
      {children}
    </div>
  )
}

const inputClass = 'h-12 w-full rounded-xl border-0 bg-[#f4f4f6] px-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-orange-500/20'
