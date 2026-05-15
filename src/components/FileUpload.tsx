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
  currentUrl?: string // Added back for single-file compatibility
  currentUrls?: string[] // For multiple files
  multiple?: boolean
  onUpload: (urlsOrPaths: any) => void 
  onRemove?: (index?: number) => void 
  userId: string
  folder?: string
}

export function FileUpload({
  mode,
  label,
  hint,
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
  // States to keep track of uploaded files
  const [previews, setPreviews] = useState<string[]>(initialUrls)
  const [fileNames, setFileNames] = useState<string[]>(initialUrls.map(url => url.split('/').pop() || 'Arquivo anexado'))
  
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const bucket = mode === 'image' ? 'product-images' : 'product-files'
  const maxSize = mode === 'image' ? 5 * 1024 * 1024 : 100 * 1024 * 1024
  const maxSizeLabel = mode === 'image' ? '5MB' : '100MB'

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError(null)
    const fileArray = Array.from(files)
    
    // Check sizes
    for (const file of fileArray) {
      if (file.size > maxSize) {
        setError(`Arquivo '${file.name}' é muito grande. Máximo: ${maxSizeLabel}`)
        return
      }
    }

    setUploading(true)
    setProgress(10)
    
    const newPreviews = [...previews]
    const newFileNames = [...fileNames]
    const newPaths = [...previews] // We'll keep existing ones and append new ones

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
           newPreviews.push(path) // using path as a dummy preview for non-images
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
          // For private files: return the storage path
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
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer upload')
      // revert preview if failed?
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }, [bucket, folder, maxSize, maxSizeLabel, mode, onUpload, userId, previews, fileNames])

  const onDrop = useCallback((e: React.DragEvent) => {
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
    : '.pdf,.zip,.epub,application/pdf,application/zip')

  const G = '#00e88a'

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

  // If not multiple and already has 1 file, hide the drop zone
  const hideDropZone = !multiple && previews.length >= 1

  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
        {label}
      </label>

      {/* File List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: previews.length > 0 && !hideDropZone ? 12 : 0 }}>
        {previews.map((prev, index) => (
          <div key={index} style={{ position: 'relative' }}>
            {mode === 'image' ? (
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                <img src={prev} alt="Preview" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  style={{
                    position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)',
                    border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                    color: '#fff', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12
                  }}
                >
                  <X style={{ width: 12, height: 12 }} /> Remover
                </button>
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(0,232,138,0.06)', border: `1px solid rgba(0,232,138,0.2)`,
                borderRadius: 14, padding: '12px 16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle style={{ width: 20, height: 20, color: G, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: G, margin: 0, wordBreak: 'break-all' }}>{fileNames[index]}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Arquivo anexado</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4 }}
                >
                  <X style={{ width: 16, height: 16 }} />
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
                Enviando arquivos...
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
                Clique ou arraste {multiple ? 'seus arquivos' : 'o arquivo'} aqui
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
                {hint || (mode === 'image' ? 'JPG, PNG ou WebP — máx. 5MB' : 'PDF, ZIP ou EPUB — máx. 100MB')}
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>⚠️ {error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={inputAccept}
        style={{ display: 'none' }}
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
