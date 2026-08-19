'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Smile, Paperclip, Mic, X, Image as ImageIcon, FileText } from 'lucide-react'

interface MessageInputProps {
  onSend: (text: string, media?: File) => void
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({ onSend, disabled, placeholder }: MessageInputProps) {
  const [text, setText] = useState('')
  const [media, setMedia] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = () => {
    if ((!text.trim() && !media) || disabled) return
    onSend(text.trim(), media || undefined)
    setText('')
    setMedia(null)
    setMediaPreview(null)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setMedia(file)

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (ev) => setMediaPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setMediaPreview(file.name)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeMedia = () => {
    setMedia(null)
    setMediaPreview(null)
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-900/50 p-3">
      {media && (
        <div className="mb-2 flex items-center gap-2 p-2 rounded-lg bg-zinc-800">
          {mediaPreview && media.type.startsWith('image/') ? (
            <div className="relative">
              <img src={mediaPreview} alt="Preview" className="h-20 rounded object-cover" />
              <button
                onClick={removeMedia}
                className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <FileText className="w-8 h-8 text-zinc-400" />
              <span className="text-sm text-zinc-300 truncate max-w-[200px]">{mediaPreview}</span>
              <button
                onClick={removeMedia}
                className="text-zinc-400 hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-full transition-colors disabled:opacity-50"
          title="Anexar arquivo"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder || 'Digite sua mensagem...'}
          rows={1}
          className="flex-1 resize-none bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 min-h-[44px] max-h-[120px]"
        />

        <button
          onClick={handleSend}
          disabled={disabled || (!text.trim() && !media)}
          className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
