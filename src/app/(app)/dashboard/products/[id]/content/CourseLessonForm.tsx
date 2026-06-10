'use client'

import type { ReactNode } from 'react'
import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { AlertCircle, CheckCircle2, Plus } from 'lucide-react'
import { FileUpload } from '@/components/FileUpload'
import type { CourseContentFormState } from './form-state'
import { initialCourseContentFormState } from './form-state'

type CourseLessonFormProps = {
  moduleId: string
  userId: string
  createLesson: (state: CourseContentFormState, formData: FormData) => Promise<CourseContentFormState>
}

export function CourseLessonForm({ moduleId, userId, createLesson }: CourseLessonFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [videoFilePath, setVideoFilePath] = useState('')
  const [materialFilePaths, setMaterialFilePaths] = useState<string[]>([])
  const [state, action, pending] = useActionState(createLesson, initialCourseContentFormState)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!state.ok) return
    startTransition(() => {
      formRef.current?.reset()
      setVideoFilePath('')
      setMaterialFilePaths([])
    })
  }, [state.ok, startTransition])

  return (
    <form ref={formRef} action={action} className="mt-5 border-t border-slate-100 pt-5">
      <input type="hidden" name="module_id" value={moduleId} />
      <input type="hidden" name="video_file_path" value={videoFilePath} />
      <input type="hidden" name="material_file_paths" value={JSON.stringify(materialFilePaths)} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Titulo da aula" required hint="Nome que aparece para o aluno.">
          <input name="title" required minLength={3} className={inputClass} placeholder="Ex: Aula 01 - Introducao" />
        </Field>

        <Field label="Duracao em minutos" hint="Opcional. Ajuda o aluno a planejar o estudo.">
          <input name="duration_minutes" type="number" min="0" className={inputClass} placeholder="Ex: 12" />
        </Field>

        <Field label="URL externa do video" hint="Opcional se voce usar upload nativo.">
          <input name="video_url" type="url" className={inputClass} placeholder="https://..." />
        </Field>

        <Field label="Material complementar externo" hint="Opcional. Link para Notion, Drive, planilha etc.">
          <input name="content_url" type="url" className={inputClass} placeholder="https://..." />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <FileUpload
          mode="video"
          label="Video nativo Flowyn"
          hint="Opcional. MP4, WebM ou MOV — máx. 500MB por vídeo."
          userId={userId}
          folder="lesson-videos"
          currentUrl={videoFilePath}
          onUpload={(path) => setVideoFilePath(Array.isArray(path) ? path[0] : path)}
          onRemove={() => setVideoFilePath('')}
        />
        <FileUpload
          mode="file"
          label="Materiais nativos"
          hint="Opcional. PDF, ZIP, EPUB ou arquivos de apoio."
          userId={userId}
          folder="lesson-materials"
          multiple
          currentUrls={materialFilePaths}
          onUpload={(paths) => setMaterialFilePaths(Array.isArray(paths) ? paths : [paths])}
          onRemove={(index) => {
            if (index === undefined) return
            setMaterialFilePaths(paths => paths.filter((_, idx) => idx !== index))
          }}
        />
      </div>

      <div className="mt-4">
        <Field label="Descricao da aula" hint="Opcional. Explique objetivo, contexto ou instrucoes.">
          <textarea name="description" className={`${inputClass} min-h-24 resize-y py-3`} placeholder="Resumo da aula para o aluno" />
        </Field>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <input type="checkbox" name="is_free_preview" className="accent-orange-500" />
          Aula preview gratis
        </label>

        <button disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Plus className="h-4 w-4" />}
          {pending ? 'Adicionando...' : 'Adicionar aula'}
        </button>
      </div>

      <FormMessage state={state} />
    </form>
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
    <div className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${state.ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-red-50 text-red-700 ring-red-100'}`}>
      {state.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      {state.message}
    </div>
  )
}

const inputClass = 'h-12 w-full rounded-xl border-0 bg-[#f4f4f6] px-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-orange-500/20'
