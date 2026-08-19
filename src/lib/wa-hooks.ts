'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import type {
  WaSession,
  WaMessage,
  WaContact,
  WaChat,
  WaChatSummary,
  WaQueue,
  WaQuickReply,
  WaTag,
  WaDashboardStats,
} from './wa-types'

// ============================================
// Hook: useSessions
// ============================================
export function useSessions() {
  const [sessions, setSessions] = useState<WaSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const { data, error } = await supabase
          .from('wa_sessions')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setSessions(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar sessões')
      } finally {
        setLoading(false)
      }
    }

    fetchSessions()

    // Escutar mudanças em tempo real
    const channel = supabase
      .channel('wa-sessions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'wa_sessions',
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setSessions(prev => [payload.new as WaSession, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setSessions(prev => prev.map(s => 
            s.id === payload.new.id ? payload.new as WaSession : s
          ))
        } else if (payload.eventType === 'DELETE') {
          setSessions(prev => prev.filter(s => s.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const connectedSessions = useMemo(() => 
    sessions.filter(s => s.status === 'connected'),
    [sessions]
  )

  return { sessions, connectedSessions, loading, error }
}

// ============================================
// Hook: useSession
// ============================================
export function useSession(sessionId: string | null) {
  const [session, setSession] = useState<WaSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }

    const fetchSession = async () => {
      try {
        const { data, error } = await supabase
          .from('wa_sessions')
          .select('*')
          .eq('id', sessionId)
          .single()

        if (error) throw error
        setSession(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar sessão')
      } finally {
        setLoading(false)
      }
    }

    fetchSession()

    // Escutar mudanças
    const channel = supabase
      .channel('wa-session')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wa_sessions',
        filter: `id=eq.${sessionId}`
      }, (payload) => {
        setSession(payload.new as WaSession)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  return { session, loading, error }
}

// ============================================
// Hook: useChats
// ============================================
export function useChats(sessionId: string | null) {
  const [chats, setChats] = useState<WaChatSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }

    const fetchChats = async () => {
      try {
        const { data, error } = await supabase
          .from('wa_chats')
          .select('*')
          .eq('session_id', sessionId)
          .order('last_message_at', { ascending: false })

        if (error) throw error
        setChats(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar conversas')
      } finally {
        setLoading(false)
      }
    }

    fetchChats()

    // Escutar mudanças em tempo real
    const channel = supabase
      .channel('wa-chats')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'wa_chats',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setChats(prev => [payload.new as WaChatSummary, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setChats(prev => prev.map(chat => 
            chat.chat_jid === (payload.new as WaChatSummary).chat_jid 
              ? payload.new as WaChatSummary 
              : chat
          ))
        } else if (payload.eventType === 'DELETE') {
          setChats(prev => prev.filter(chat => 
            chat.chat_jid !== (payload.old as WaChatSummary).chat_jid
          ))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  const waitingChats = useMemo(() => 
    chats.filter(c => c.status === 'waiting'),
    [chats]
  )

  const openChats = useMemo(() => 
    chats.filter(c => c.status === 'open'),
    [chats]
  )

  const totalUnread = useMemo(() => 
    chats.reduce((sum, c) => sum + (c.unread_count || 0), 0),
    [chats]
  )

  return { chats, waitingChats, openChats, totalUnread, loading, error }
}

// ============================================
// Hook: useMessages
// ============================================
export function useMessages(sessionId: string, chatJid: string | null) {
  const [messages, setMessages] = useState<WaMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!chatJid) {
      setLoading(false)
      return
    }

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('wa_messages')
          .select('*')
          .eq('session_id', sessionId)
          .eq('chat_jid', chatJid)
          .order('timestamp', { ascending: true })
          .limit(100)

        if (error) throw error
        setMessages(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar mensagens')
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()

    // Escutar novas mensagens
    const channel = supabase
      .channel('wa-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'wa_messages',
        filter: `session_id=eq.${sessionId},chat_jid=eq.${chatJid}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as WaMessage])
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wa_messages',
        filter: `session_id=eq.${sessionId},chat_jid=eq.${chatJid}`
      }, (payload) => {
        setMessages(prev => prev.map(msg => 
          msg.id === (payload.new as WaMessage).id 
            ? payload.new as WaMessage 
            : msg
        ))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, chatJid])

  const sendMessage = useCallback(async (text: string, mediaUrl?: string) => {
    if (!chatJid) return

    try {
      const response = await fetch('/api/wa/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          chat_jid: chatJid,
          to_jid: chatJid,
          body: text,
          media_url: mediaUrl,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao enviar mensagem')
      }

      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem')
      throw err
    }
  }, [sessionId, chatJid])

  return { messages, sendMessage, loading, error }
}

// ============================================
// Hook: useContacts
// ============================================
export function useContacts(search?: string) {
  const [contacts, setContacts] = useState<WaContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        let query = supabase
          .from('wa_contacts')
          .select('*')
          .order('last_seen', { ascending: false })
          .limit(100)

        if (search) {
          query = query.or(`phone.ilike.%${search}%,name.ilike.%${search}%,push_name.ilike.%${search}%`)
        }

        const { data, error } = await query

        if (error) throw error
        setContacts(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar contatos')
      } finally {
        setLoading(false)
      }
    }

    fetchContacts()
  }, [search])

  return { contacts, loading, error }
}

// ============================================
// Hook: useQueues
// ============================================
export function useQueues() {
  const [queues, setQueues] = useState<WaQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchQueues = async () => {
      try {
        const { data, error } = await supabase
          .from('wa_queues')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setQueues(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar filas')
      } finally {
        setLoading(false)
      }
    }

    fetchQueues()
  }, [])

  return { queues, loading, error }
}

// ============================================
// Hook: useQuickReplies
// ============================================
export function useQuickReplies() {
  const [quickReplies, setQuickReplies] = useState<WaQuickReply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchQuickReplies = async () => {
      try {
        const { data, error } = await supabase
          .from('wa_quick_replies')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setQuickReplies(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar respostas rápidas')
      } finally {
        setLoading(false)
      }
    }

    fetchQuickReplies()
  }, [])

  return { quickReplies, loading, error }
}

// ============================================
// Hook: useTags
// ============================================
export function useTags() {
  const [tags, setTags] = useState<WaTag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const { data, error } = await supabase
          .from('wa_tags')
          .select('*')
          .order('name')

        if (error) throw error
        setTags(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar tags')
      } finally {
        setLoading(false)
      }
    }

    fetchTags()
  }, [])

  return { tags, loading, error }
}

// ============================================
// Hook: useDashboard
// ============================================
export function useDashboard() {
  const [stats, setStats] = useState<WaDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          sessionsResult,
          contactsResult,
          chatsResult,
          messagesResult,
          ratingsResult,
        ] = await Promise.all([
          supabase.from('wa_sessions').select('id, status'),
          supabase.from('wa_contacts').select('id', { count: 'exact' }),
          supabase.from('wa_chats').select('id, status'),
          supabase.from('wa_messages').select('id', { count: 'exact' }),
          supabase.from('wa_ratings').select('score'),
        ])

        const sessions = sessionsResult.data || []
        const contacts = contactsResult.data || []
        const chats = chatsResult.data || []
        const ratings = ratingsResult.data || []

        const avgCsat = ratings.length > 0
          ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
          : 0

        setStats({
          total_sessions: sessions.length,
          connected_sessions: sessions.filter(s => s.status === 'connected').length,
          total_contacts: contacts.length,
          total_messages_today: messagesResult.count || 0,
          open_chats: chats.filter(c => c.status === 'open').length,
          waiting_chats: chats.filter(c => c.status === 'waiting').length,
          avg_response_time: 0,
          csat_score: Math.round(avgCsat * 10) / 10,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar estatísticas')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return { stats, loading, error }
}
