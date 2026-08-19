'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChatList } from '@/components/wa/ChatList'
import { ChatWindow } from '@/components/wa/ChatWindow'
import { MessageSquare } from 'lucide-react'

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

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'waiting'>('all')

  const fetchChats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      
      const url = filter === 'all' ? '/api/wa/chats' : `/api/wa/chats?${params}`
      const response = await fetch(url)
      const data = await response.json()
      if (data.chats) {
        setChats(data.chats)
      }
    } catch (error) {
      console.error('Error fetching chats:', error)
    }
  }, [filter])

  const fetchMessages = useCallback(async (sessionId: string, chatJid: string) => {
    setIsLoadingMessages(true)
    try {
      const response = await fetch(`/api/wa/messages/${sessionId}/${chatJid}`)
      const data = await response.json()
      if (data.messages) {
        setMessages(data.messages)
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    fetchChats()
    const interval = setInterval(fetchChats, 10000)
    return () => clearInterval(interval)
  }, [fetchChats])

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.session_id, selectedChat.chat_jid)
    }
  }, [selectedChat, fetchMessages])

  const handleSendMessage = async (text: string, media?: File) => {
    if (!selectedChat) return

    try {
      const response = await fetch('/api/wa/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: selectedChat.session_id,
          chat_jid: selectedChat.chat_jid,
          to_jid: selectedChat.chat_jid,
          body: text,
        }),
      })

      if (response.ok) {
        fetchMessages(selectedChat.session_id, selectedChat.chat_jid)
        fetchChats()
      }
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const handleUpdateChat = async (updates: Partial<Chat>) => {
    if (!selectedChat) return

    try {
      const response = await fetch('/api/wa/chats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedChat.id, ...updates }),
      })

      if (response.ok) {
        setSelectedChat({ ...selectedChat, ...updates })
        fetchChats()
      }
    } catch (error) {
      console.error('Error updating chat:', error)
    }
  }

  return (
    <div className="flex h-full">
      <div className="w-80 border-r border-zinc-800 flex-shrink-0">
        <ChatList
          chats={chats}
          selectedChatId={selectedChat?.id}
          onSelectChat={setSelectedChat}
          filter={filter}
          onFilterChange={setFilter}
        />
      </div>

      <div className="flex-1">
        {selectedChat ? (
          <ChatWindow
            chat={selectedChat}
            messages={messages}
            onSendMessage={handleSendMessage}
            onUpdateChat={handleUpdateChat}
            isLoading={isLoadingMessages}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-zinc-400 mb-2">
                Selecione uma conversa
              </h3>
              <p className="text-sm text-zinc-500">
                Escolha uma conversa ao lado para começar
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
