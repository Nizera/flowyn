'use client'

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react'

interface MessageBubbleProps {
  id: string
  body: string
  isFromMe: boolean
  timestamp: number
  status?: string
  kind?: string
  mediaUrl?: string
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5 text-zinc-400" />,
  sent: <Check className="w-3.5 h-3.5 text-zinc-400" />,
  delivered: <CheckCheck className="w-3.5 h-3.5 text-zinc-400" />,
  read: <CheckCheck className="w-3.5 h-3.5 text-blue-400" />,
  error: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
}

export function MessageBubble({
  body,
  isFromMe,
  timestamp,
  status,
  kind,
  mediaUrl,
}: MessageBubbleProps) {
  const time = format(new Date(timestamp), 'HH:mm')

  return (
    <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`
          relative max-w-[75%] px-3 py-2 rounded-xl text-sm
          ${isFromMe
            ? 'bg-emerald-700/90 text-white rounded-br-sm'
            : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'
          }
        `}
      >
        {mediaUrl && kind === 'image' && (
          <img
            src={mediaUrl}
            alt="Mídia"
            className="rounded-lg mb-2 max-w-full max-h-64 object-cover"
          />
        )}

        {mediaUrl && kind === 'video' && (
          <video
            src={mediaUrl}
            controls
            className="rounded-lg mb-2 max-w-full max-h-64"
          />
        )}

        {mediaUrl && kind === 'audio' && (
          <audio src={mediaUrl} controls className="mb-2 w-full" />
        )}

        <p className="whitespace-pre-wrap break-words">{body}</p>

        <div className={`flex items-center gap-1 mt-1 ${isFromMe ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] opacity-60">{time}</span>
          {isFromMe && status && statusIcons[status]}
        </div>
      </div>
    </div>
  )
}
