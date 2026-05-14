'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Upload, X, CheckCircle, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'

type UploadMode = 'image' | 'file'

interface FileUploadProps {
  mode: UploadMode
  label: string
  hint?: string
  accept?: string
  currentUrl?: string
  onUpload: (urlOrPath: string) => void
  onRemove?: () => void
  userId: string
  folder?: string
}

export function FileUpload({
  mode,
  label,
  hint,
  accept,
  currentUrl,
  onUpload,
  onRemove,
  userId,
  folder = '',
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl || null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const bucket = mode === 'image' ? 'product-images' : 'product-files'
  const maxSize = mode === 'image' ? 5 * 1024 * 1024 : 100 * 1024 * 1024
  const maxSizeLabel = mode === 'image' ? '5MB' : '100MB'

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    if (file.size > maxSize) {
      setError(`Arquivo muito grande. Máximo: ${maxSizeLabel}`)
      return
    }

    setUploading(true)
    setProgress(10)
    setFileName(file.name)

    if (mode === 'image') {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const subfolder = folder ? `${userId}/${folder}` : userId
      const path = `${subfolder}/${Date.now()}.${ext}`

      setProgress(30)

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      setProgress(90)

      if (mode === 'image') {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
        onUpload(urlData.publicUrl)
      } else {
        // For private files: return the storage path (not public URL)
        onUpload(path)
      }

      setProgress(100)
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer upload')
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }, [bucket, folder, maxSize, maxSizeLabel, mode, onUpload, userId])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const inputAccept = accept || (mode === 'image'
    ? 'image/jpeg,image/png,image/webp'
    : '.pdf,.zip,.epub,application/pdf,application/zip')

  const G = '#00e88a'
  const isDone = progress === 100 && !uploading

  const handleRemove = () => {
    setPreview(null)
    setFileName(null)
    setProgress(0)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
    onRemove?.()
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
        {label}
      </label>

      {/* Drop zone */}
      {!isDone && !preview && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${isDragging ? G : uploading ? 'rgba(0,232,138,0.3)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 16,
            padding: '28px 20px',
            textAlign: 'center',
            cursor: uploading ? 'default' : 'pointer',
            background: isDragging ? 'rgba(0,232,138,0.04)' : '#0a0a0a',
            transition: 'all 0.2s',
          }}
        >
          {uploading ? (
            <>
              <Loader2 style={{ width: 28, height: 28, color: G, margin: '0 auto 10px', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 10px' }}>
                Enviando {fileName}...
              </p>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, background: G, width: `${progress}%`, transition: 'width 0.3s' }} />
              </div>
            </>
          ) : (
            <>
              {mode === 'image'
                ? <ImageIcon style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.2)', margin: '0 auto 10px' }} />
                : <FileText style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.2)', margin: '0 auto 10px' }} />
              }
              <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px' }}>
                Clique ou arraste o arquivo aqui
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
                {hint || (mode === 'image' ? 'JPG, PNG ou WebP — máx. 5MB' : 'PDF, ZIP ou EPUB — máx. 100MB')}
              </p>
            </>
          )}
        </div>
      )}

      {/* Image preview */}
      {mode === 'image' && preview && (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          <img src={preview} alt="Preview" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
          <button
            type="button"
            onClick={handleRemove}
            style={{
              position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)',
              border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
              color: '#fff', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12
            }}
          >
            <X style={{ width: 12, height: 12 }} /> Remover
          </button>
        </div>
      )}

      {/* File done state */}
      {mode === 'file' && isDone && fileName && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0,232,138,0.06)', border: `1px solid rgba(0,232,138,0.2)`,
          borderRadius: 14, padding: '12px 16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle style={{ width: 20, height: 20, color: G, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: G, margin: 0 }}>{fileName}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Arquivo enviado com sucesso</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>⚠️ {error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={inputAccept}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
