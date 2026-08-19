'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Phone,
  Video,
  MoreVertical,
  Tag,
  UserPlus,
  CheckCircle2,
  XCircle,
  Archive,
  Trash2,
  Info,
  Clock,
  Users,
  MessageSquare,
} from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { cn } from '@/lib/utils'

interface Chat {
  id: string
  session_id: string
  chat_jid: string
  name?: string
  push_name?: string
  phone?: string
  avatar?: string
  status: string
  queue_id?: string
  assigned_to?: string
  tags?: string[]
}

interface Message {
  id: string
  session_id: string
  chat_jid: string
  from_jid: string
  to_jid: string
  body: string
  kind?: string
  media_url?: string
  quoted_id?: string
  is_from_me: boolean
  status?: string
  timestamp: number
}

interface ChatWindowProps {
  chat: Chat
  messages: Message[]
  onSendMessage: (text: string, media?: File) => void
  onUpdateChat: (updates: Partial<Chat>) => void
  onClose?: () => void
  isLoading?: boolean
}

function getChatName(chat: Chat): string {
  return chat.name || chat.push_name || chat.phone || chat.chat_jid.split('@')[0]
}

const statusLabels: Record<string, { label: string; color: string }> = {
  waiting: { label: 'Aguardando', color: 'bg-amber-500/20 text-amber-400' },
  open: { label: 'Aberto', color: 'bg-emerald-500/20 text-emerald-400' },
  closed: { label: 'Fechado', color: 'bg-zinc-500/20 text-zinc-400' },
  group: { label: 'Grupo', color: 'bg-blue-500/20 text-blue-400' },
}

export function ChatWindow({
  chat,
  messages,
  onSendMessage,
  onUpdateChat,
  onClose,
  isLoading,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleStatusChange = (status: string) => {
    onUpdateChat({ status })
    setShowMenu(false)
  }

  const status = statusLabels[chat.status] || statusLabels.open

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-lg font-medium text-zinc-300">
            {getChatName(chat).charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-medium text-zinc-100">{getChatName(chat)}</h3>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs px-2 py-0.5 rounded-full', status.color)}>
                {status.label}
              </span>
              {chat.assigned_to && (
                <span className="text-xs text-zinc-500">
                  <UserPlus className="w-3 h-3 inline mr-1" />
                  Atendente
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-full transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-1">
                <button
                  onClick={() => handleStatusChange('open')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
                >
                  <MessageSquare className="w-4 h-4" />
                  Marcar como Aberto
                </button>
                <button
                  onClick={() => handleStatusChange('waiting')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
                >
                  <Clock className="w-4 h-4" />
                  Marcar como Aguardando
                </button>
                <button
                  onClick={() => handleStatusChange('closed')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
                >
                  <XCircle className="w-4 h-4" />
                  Marcar como Fechado
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <Clock className="w-8 h-8 animate-spin" />
              <p className="text-sm">Carregando mensagens...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <MessageSquare className="w-12 h-12 opacity-50" />
              <p className="text-sm">Nenhuma mensagem ainda</p>
              <p className="text-xs">Envie uma mensagem para iniciar a conversa</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                id={msg.id}
                body={msg.body}
                isFromMe={msg.is_from_me}
                timestamp={msg.timestamp}
                status={msg.status}
                kind={msg.kind}
                mediaUrl={msg.media_url}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <MessageInput
        onSend={onSendMessage}
        disabled={chat.status === 'closed'}
        placeholder={
          chat.status === 'closed'
            ? 'Conversa encerrada'
            : 'Digite sua mensagem...'
        }
      />
    </div>
  )
}
