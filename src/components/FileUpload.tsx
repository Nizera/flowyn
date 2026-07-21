'use client'

import { useState, useRef, useCallback, type DragEvent } from 'react'
import { createClient } from '@/utils/supabase/client'
import { X, CheckCircle, FileText, Image as ImageIcon, Loader2, Video } from 'lucide-react'

type UploadMode = 'image' | 'file' | 'video'

type UploadResult = string | string[]

interface FileUploadProps {
  mode: UploadMode
  label: string
  hint?: string
  dimensionsHint?: string
  accept?: string
  currentUrl?: string
  currentUrls?: string[]
  multiple?: boolean
  onUpload: (urlsOrPaths: UploadResult) => void
  onRemove?: (index?: number) => void
  userId: string
  folder?: string
}

export function FileUpload({
  mode,
  label,
  hint,
  dimensionsHint,
  accept,
  currentUrl,
  currentUrls,
  multiple = false,
  onUpload,
  onRemove,
  userId,
  folder = '',
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const initialUrls = currentUrls || (currentUrl ? [currentUrl] : [])
  const [previews, setPreviews] = useState<string[]>(initialUrls)
  const [fileNames, setFileNames] = useState<string[]>(initialUrls.map(url => url.split('/').pop() || 'Arquivo anexado'))

  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const bucket = mode === 'image' ? 'product-images' : 'product-files'
  const maxSize = mode === 'image' ? 5 * 1024 * 1024 : mode === 'video' ? 500 * 1024 * 1024 : 100 * 1024 * 1024
  const maxSizeLabel = mode === 'image' ? '5MB' : mode === 'video' ? '500MB' : '100MB'

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError(null)
    const fileArray = Array.from(files)

    for (const file of fileArray) {
      if (file.size > maxSize) {
        setError(`Arquivo '${file.name}' e muito grande. Maximo: ${maxSizeLabel}`)
        return
      }
    }

    setUploading(true)
    setProgress(10)

    const newPreviews = [...previews]
    const newFileNames = [...fileNames]
    const newPaths = [...previews]

    try {
      const supabase = createClient()
      const subfolder = folder ? `${userId}/${folder}` : userId

      const step = 80 / fileArray.length

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]
        const ext = file.name.split('.').pop()
        const path = `${subfolder}/${Date.now()}_${i}.${ext}`

        if (mode === 'image') {
          const reader = new FileReader()
          const previewPromise = new Promise<string>((resolve) => {
            reader.onload = (e) => resolve(e.target?.result as string)
          })
          reader.readAsDataURL(file)
          newPreviews.push(await previewPromise)
        } else {
          newPreviews.push(path)
        }

        newFileNames.push(file.name)

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file, { cacheControl: '3600', upsert: false })

        if (uploadError) throw uploadError

        if (mode === 'image') {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
          newPaths.push(urlData.publicUrl)
        } else {
          newPaths.push(path)
        }

        setProgress(10 + step * (i + 1))
      }

      setPreviews(newPreviews)
      setFileNames(newFileNames)

      if (multiple) {
        onUpload(newPaths)
      } else {
        onUpload(newPaths[0])
      }

      setProgress(100)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err ?? 'Erro ao fazer upload')
      setError(message)
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }, [bucket, folder, maxSize, maxSizeLabel, mode, multiple, onUpload, userId, previews, fileNames])

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.length > 0) {
      if (multiple) {
        handleFiles(e.dataTransfer.files)
      } else {
        handleFiles([e.dataTransfer.files[0]])
      }
    }
  }, [handleFiles, multiple])

  const inputAccept = accept || (mode === 'image'
    ? 'image/jpeg,image/png,image/webp'
    : mode === 'video'
      ? 'video/mp4,video/webm,video/quicktime'
      : '.pdf,.zip,.epub,application/pdf,application/zip')

  const handleRemoveItem = (index: number) => {
    const p = [...previews]
    p.splice(index, 1)
    setPreviews(p)

    const f = [...fileNames]
    f.splice(index, 1)
    setFileNames(f)

    if (inputRef.current) inputRef.current.value = ''

    if (multiple) {
      onRemove?.(index)
      onUpload(p)
    } else {
      onRemove?.()
      onUpload('')
    }
  }

  const hideDropZone = !multiple && previews.length >= 1

  return (
    <div>
      <label className="block text-xs font-black uppercase tracking-wider text-muted mb-2">
        {label}
      </label>

      {/* File List */}
      <div className="flex flex-col gap-2 mb-3">
        {previews.map((prev, index) => (
          <div key={index} className="relative">
            {mode === 'image' ? (
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img src={prev} alt="Preview" className="w-full h-36 object-cover block" />
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="absolute top-2 right-2 bg-black/70 border-none rounded-lg px-2 py-1 cursor-pointer text-white flex items-center gap-1 text-xs"
                >
                  <X className="w-3 h-3" /> Remover
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-foreground m-0 break-all">{fileNames[index]}</p>
                    <p className="text-xs text-muted m-0">Arquivo anexado</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="bg-transparent border-none cursor-pointer text-muted p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Drop zone */}
      {!hideDropZone && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`rounded-2xl p-7 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-2 border-dashed border-primary bg-primary/10'
              : uploading
                ? 'border-2 border-dashed border-border bg-surface'
                : 'border-2 border-dashed border-border bg-surface hover:bg-surface-elevated'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-7 h-7 text-primary mx-auto mb-2.5 animate-spin" />
              <p className="text-sm text-muted m-0 mb-2.5">
                Enviando arquivos...
              </p>
              <div className="bg-surface-elevated rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : (
            <>
              {mode === 'image'
                ? <ImageIcon className="w-7 h-7 text-muted mx-auto mb-2.5" />
                : mode === 'video'
                  ? <Video className="w-7 h-7 text-muted mx-auto mb-2.5" />
                  : <FileText className="w-7 h-7 text-muted mx-auto mb-2.5" />
              }
              <p className="text-sm font-bold text-foreground m-0 mb-1">
                Clique ou arraste {multiple ? 'seus arquivos' : 'o arquivo'} aqui
              </p>
              <p className="text-xs text-muted m-0">
                {hint || (mode === 'image' ? 'JPG, PNG ou WebP — max. 5MB' : mode === 'video' ? 'MP4, WebM ou MOV — max. 500MB' : 'PDF, ZIP ou EPUB — max. 100MB')}
                {dimensionsHint && <span className="block mt-1 text-primary">{dimensionsHint}</span>}
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mt-1.5">⚠️ {error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={inputAccept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            if (multiple) {
              handleFiles(e.target.files)
            } else {
              handleFiles([e.target.files[0]])
            }
          }
        }}
      />
    </div>
  )
}
