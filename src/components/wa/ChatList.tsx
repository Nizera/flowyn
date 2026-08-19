'use client'

import { useState } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Search,
  Pin,
  Archive,
  Users,
  MessageSquare,
  Clock,
  CheckCircle2,
  MoreVertical,
  Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Chat {
  id: string
  session_id: string
  chat_jid: string
  name?: string
  push_name?: string
  phone?: string
  avatar?: string
  last_message?: string
  last_message_at?: number
  unread_count: number
  is_pinned: boolean
  is_archived: boolean
  status: string
  queue_id?: string
  assigned_to?: string
  tags?: string[]
}

interface ChatListProps {
  chats: Chat[]
  selectedChatId?: string
  onSelectChat: (chat: Chat) => void
  filter?: 'all' | 'open' | 'closed' | 'waiting'
  onFilterChange?: (filter: 'all' | 'open' | 'closed' | 'waiting') => void
}

function formatChatTime(timestamp?: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Ontem'
  return format(date, 'dd/MM/yyyy')
}

function getChatName(chat: Chat): string {
  return chat.name || chat.push_name || chat.phone || chat.chat_jid.split('@')[0]
}

export function ChatList({
  chats,
  selectedChatId,
  onSelectChat,
  filter = 'all',
  onFilterChange,
}: ChatListProps) {
  const [search, setSearch] = useState('')

  const filteredChats = chats
    .filter((chat) => {
      if (search) {
        const name = getChatName(chat).toLowerCase()
        const phone = chat.phone?.toLowerCase() || ''
        const query = search.toLowerCase()
        if (!name.includes(query) && !phone.includes(query)) return false
      }
      if (filter === 'open') return chat.status === 'open'
      if (filter === 'waiting') return chat.status === 'waiting'
      if (filter === 'closed') return chat.status === 'closed'
      return true
    })
    .sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      return (b.last_message_at || 0) - (a.last_message_at || 0)
    })

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-zinc-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversas..."
            className="w-full pl-9 pr-3 py-2 bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <div className="flex gap-1 mt-2">
          {(['all', 'open', 'waiting', 'closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange?.(f)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                filter === f
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              )}
            >
              {f === 'all' ? 'Todos' : f === 'open' ? 'Abertos' : f === 'waiting' ? 'Aguardando' : 'Fechados'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-4">
            <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          filteredChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat)}
              className={cn(
                'w-full flex items-start gap-3 p-3 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors text-left',
                selectedChatId === chat.id && 'bg-zinc-800/80'
              )}
            >
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-lg font-medium text-zinc-300">
                  {getChatName(chat).charAt(0).toUpperCase()}
                </div>
                {chat.is_pinned && (
                  <div className="absolute -top-1 -right-1">
                    <Pin className="w-3 h-3 text-zinc-400 fill-zinc-400" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-100 truncate">
                    {getChatName(chat)}
                  </span>
                  <span className="text-xs text-zinc-500 flex-shrink-0">
                    {formatChatTime(chat.last_message_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-sm text-zinc-400 truncate">
                    {chat.last_message || 'Nenhuma mensagem'}
                  </p>
                  {chat.unread_count > 0 && (
                    <span className="flex-shrink-0 bg-emerald-600 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {chat.unread_count}
                    </span>
                  )}
                </div>

                {chat.tags && chat.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {chat.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
