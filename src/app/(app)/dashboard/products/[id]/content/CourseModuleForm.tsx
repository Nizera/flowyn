'use client'

import type { ReactNode } from 'react'
import { useActionState, useEffect, useRef } from 'react'
import { AlertCircle, CheckCircle2, Plus } from 'lucide-react'
import type { CourseContentFormState } from './form-state'
import { initialCourseContentFormState } from './form-state'

type CourseModuleFormProps = {
  createModule: (state: CourseContentFormState, formData: FormData) => Promise<CourseContentFormState>
}

export function CourseModuleForm({ createModule }: CourseModuleFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(createModule, initialCourseContentFormState)

  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state.ok, state.message])

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <Field label="Nome do modulo" required hint="Ex: Boas-vindas, Fundamentos, Aulas praticas">
        <input name="title" required minLength={3} className={inputClass} placeholder="Digite o nome do modulo" />
      </Field>

      <Field label="Descricao curta" hint="Opcional. Ajuda o aluno a entender o objetivo do modulo.">
        <textarea name="description" className={`${inputClass} min-h-24 resize-y py-3`} placeholder="O que o aluno vai aprender aqui?" />
      </Field>

      <FormMessage state={state} />

      <button disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Plus className="h-4 w-4" />}
        {pending ? 'Criando...' : 'Criar modulo'}
      </button>
    </form>
  )
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">
        {label}{required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-5 text-muted">{hint}</span>}
    </label>
  )
}

function FormMessage({ state }: { state: CourseContentFormState }) {
  if (!state.message) return null
  return (
    <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${state.ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-red-50 text-red-700 ring-red-100'}`}>
      {state.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      {state.message}
    </div>
  )
}

const inputClass = 'h-12 w-full rounded-xl border-0 bg-surface px-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted focus:bg-card focus:ring-2 focus:ring-orange-500/20'
