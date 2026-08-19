// ============================================
// WhatsApp CRM - Cliente WA Worker
// ============================================

import type {
  WaSession,
  WaSessionCreate,
  WaSessionUpdate,
  WaMessage,
  WaMessageCreate,
  WaContact,
  WaContactCreate,
  WaContactUpdate,
  WaChat,
  WaChatUpdate,
  WaChatSummary,
  WaQueue,
  WaQueueCreate,
  WaQueueUpdate,
  WaQueueMember,
  WaQueueMemberCreate,
  WaQuickReply,
  WaQuickReplyCreate,
  WaTag,
  WaTagCreate,
  WaChatEvent,
  WaChatEventCreate,
  WaRating,
  WaRatingCreate,
  WaScheduledMessage,
  WaScheduledMessageCreate,
  WaDashboardStats,
  WaPixPaymentCreate,
  WaPixPaymentResponse,
} from './wa-types'

// ============================================
// Configuração
// ============================================
const WA_WORKER_URL = process.env.WA_WORKER_URL || 'http://localhost:3001'
const WA_WORKER_SECRET = process.env.WA_WORKER_SECRET || ''

// ============================================
// Helpers
// ============================================
async function workerFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${WA_WORKER_URL}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WA_WORKER_SECRET}`,
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

// ============================================
// Sessões WhatsApp
// ============================================
export const waSessions = {
  /**
   * Listar todas as sessões do usuário
   */
  async list(): Promise<WaSession[]> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('wa_sessions')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  /**
   * Buscar uma sessão por ID
   */
  async get(id: string): Promise<WaSession | null> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('wa_sessions')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) return null
    return data
  },

  /**
   * Criar nova sessão
   */
  async create(data: WaSessionCreate): Promise<WaSession> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const id = crypto.randomUUID()
    const integration_token = crypto.randomUUID()
    
    const { data: session, error } = await supabase
      .from('wa_sessions')
      .insert({
        id,
        name: data.name,
        phone_number: data.phone_number || null,
        color: data.color || '#25D366',
        is_default: data.is_default || false,
        allow_groups: data.allow_groups || false,
        queue_id: data.queue_id || null,
        greeting_message: data.greeting_message || null,
        completion_message: data.completion_message || null,
        out_of_hours_message: data.out_of_hours_message || null,
        integration_token,
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return session
  },

  /**
   * Atualizar sessão
   */
  async update(id: string, data: WaSessionUpdate): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_sessions')
      .update(data)
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },

  /**
   * Deletar sessão
   */
  async delete(id: string): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_sessions')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },

  /**
   * Gerar QR Code para pareamento
   */
  async pair(id: string): Promise<{ qr_code: string }> {
    return workerFetch(`/api/sessions/${id}/pair`, {
      method: 'POST',
    })
  },

  /**
   * Desconectar sessão
   */
  async logout(id: string): Promise<void> {
    await workerFetch(`/api/sessions/${id}/logout`, {
      method: 'POST',
    })
  },

  /**
   * Verificar status da conexão
   */
  async status(id: string): Promise<{ connected: boolean; phone?: string }> {
    return workerFetch(`/api/sessions/${id}/status`)
  },
}

// ============================================
// Mensagens
// ============================================
export const waMessages = {
  /**
   * Listar mensagens de uma conversa
   */
  async list(
    sessionId: string,
    chatJid: string,
    limit = 50,
    before?: number
  ): Promise<WaMessage[]> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    let query = supabase
      .from('wa_messages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('chat_jid', chatJid)
      .order('timestamp', { ascending: true })
      .limit(limit)
    
    if (before) {
      query = query.lt('timestamp', before)
    }
    
    const { data, error } = await query
    
    if (error) throw new Error(error.message)
    return data || []
  },

  /**
   * Enviar mensagem
   */
  async send(data: WaMessageCreate): Promise<WaMessage> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const id = crypto.randomUUID()
    
    // Inserir mensagem localmente
    const { data: message, error } = await supabase
      .from('wa_messages')
      .insert({
        id,
        session_id: data.session_id,
        chat_jid: data.chat_jid,
        from_jid: data.session_id,
        to_jid: data.to_jid,
        body: data.body,
        kind: data.kind || 'text',
        media_url: data.media_url || null,
        is_from_me: true,
        status: 'pending',
        timestamp: Date.now(),
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    
    // Enviar via WA Worker (em background)
    workerFetch('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: data.session_id,
        to: data.to_jid,
        text: data.body,
        media: data.media_url,
      }),
    }).catch(console.error)
    
    return message
  },

  /**
   * Enviar mensagem em massa
   */
  async sendBulk(
    sessionId: string,
    contacts: string[],
    text: string,
    mediaUrl?: string
  ): Promise<{ sent: number; failed: number }> {
    return workerFetch('/api/messages/bulk', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        contacts,
        text,
        media: mediaUrl,
      }),
    })
  },

  /**
   * Atualizar status da mensagem
   */
  async updateStatus(
    sessionId: string,
    id: string,
    status: 'sent' | 'delivered' | 'read' | 'failed'
  ): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_messages')
      .update({ status })
      .eq('session_id', sessionId)
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

// ============================================
// Contatos
// ============================================
export const waContacts = {
  /**
   * Listar contatos do usuário
   */
  async list(search?: string, limit = 100): Promise<WaContact[]> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    let query = supabase
      .from('wa_contacts')
      .select('*')
      .order('last_seen', { ascending: false })
      .limit(limit)
    
    if (search) {
      query = query.or(`phone.ilike.%${search}%,name.ilike.%${search}%,push_name.ilike.%${search}%`)
    }
    
    const { data, error } = await query
    
    if (error) throw new Error(error.message)
    return data || []
  },

  /**
   * Buscar contato por ID
   */
  async get(id: string): Promise<WaContact | null> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('wa_contacts')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) return null
    return data
  },

  /**
   * Criar ou atualizar contato
   */
  async upsert(data: WaContactCreate): Promise<WaContact> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    
    const { data: contact, error } = await supabase
      .from('wa_contacts')
      .upsert({
        user_id: user.id,
        phone: data.phone,
        name: data.name || null,
        push_name: data.push_name || null,
        avatar_url: data.avatar_url || null,
        email: data.email || null,
        tags: data.tags || [],
        is_group: data.is_group || false,
        last_seen: new Date().toISOString(),
      }, { onConflict: 'user_id,phone' })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return contact
  },

  /**
   * Atualizar contato
   */
  async update(id: string, data: WaContactUpdate): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_contacts')
      .update(data)
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },

  /**
   * Deletar contato
   */
  async delete(id: string): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_contacts')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

// ============================================
// Chats
// ============================================
export const waChats = {
  /**
   * Listar conversas de uma sessão
   */
  async list(sessionId: string, status?: string): Promise<WaChatSummary[]> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    let query = supabase
      .from('wa_chats')
      .select('*')
      .eq('session_id', sessionId)
      .order('last_message_at', { ascending: false })
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query
    
    if (error) throw new Error(error.message)
    return data || []
  },

  /**
   * Buscar chat por JID
   */
  async get(sessionId: string, chatJid: string): Promise<WaChat | null> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('wa_chats')
      .select('*')
      .eq('session_id', sessionId)
      .eq('chat_jid', chatJid)
      .single()
    
    if (error) return null
    return data
  },

  /**
   * Atualizar chat
   */
  async update(sessionId: string, chatJid: string, data: WaChatUpdate): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_chats')
      .update(data)
      .eq('session_id', sessionId)
      .eq('chat_jid', chatJid)
    
    if (error) throw new Error(error.message)
  },

  /**
   * Marcar chat como lido
   */
  async markAsRead(sessionId: string, chatJid: string): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_chats')
      .update({ unread_count: 0 })
      .eq('session_id', sessionId)
      .eq('chat_jid', chatJid)
    
    if (error) throw new Error(error.message)
  },

  /**
   * Atribuir agente ao chat
   */
  async assign(sessionId: string, chatJid: string, userId: string): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_chats')
      .update({
        status: 'open',
        assigned_user_id: userId,
      })
      .eq('session_id', sessionId)
      .eq('chat_jid', chatJid)
    
    if (error) throw new Error(error.message)
  },

  /**
   * Fechar chat
   */
  async close(sessionId: string, chatJid: string): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_chats')
      .update({ status: 'closed' })
      .eq('session_id', sessionId)
      .eq('chat_jid', chatJid)
    
    if (error) throw new Error(error.message)
  },
}

// ============================================
// Filas
// ============================================
export const waQueues = {
  /**
   * Listar filas do usuário
   */
  async list(): Promise<WaQueue[]> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('wa_queues')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  /**
   * Criar fila
   */
  async create(data: WaQueueCreate): Promise<WaQueue> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data: queue, error } = await supabase
      .from('wa_queues')
      .insert({
        name: data.name,
        color: data.color || '#25D366',
        distribution: data.distribution || 'manual',
        max_load: data.max_load || 10,
        greeting_message: data.greeting_message || null,
        out_of_hours_message: data.out_of_hours_message || null,
        business_hours: data.business_hours || null,
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return queue
  },

  /**
   * Atualizar fila
   */
  async update(id: string, data: WaQueueUpdate): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_queues')
      .update(data)
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },

  /**
   * Deletar fila
   */
  async delete(id: string): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_queues')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },

  /**
   * Adicionar membro à fila
   */
  async addMember(data: WaQueueMemberCreate): Promise<WaQueueMember> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data: member, error } = await supabase
      .from('wa_queue_members')
      .insert({
        queue_id: data.queue_id,
        user_id: data.user_id,
        max_load: data.max_load || 10,
        is_active: data.is_active !== false,
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return member
  },

  /**
   * Remover membro da fila
   */
  async removeMember(queueId: string, userId: string): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_queue_members')
      .delete()
      .eq('queue_id', queueId)
      .eq('user_id', userId)
    
    if (error) throw new Error(error.message)
  },
}

// ============================================
// Respostas Rápidas
// ============================================
export const waQuickReplies = {
  /**
   * Listar respostas rápidas do usuário
   */
  async list(): Promise<WaQuickReply[]> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('wa_quick_replies')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  /**
   * Criar resposta rápida
   */
  async create(data: WaQuickReplyCreate): Promise<WaQuickReply> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    
    const { data: reply, error } = await supabase
      .from('wa_quick_replies')
      .insert({
        user_id: user.id,
        shortcut: data.shortcut,
        message: data.message,
        media_url: data.media_url || null,
        is_global: data.is_global || false,
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return reply
  },

  /**
   * Deletar resposta rápida
   */
  async delete(id: string): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_quick_replies')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

// ============================================
// Tags
// ============================================
export const waTags = {
  /**
   * Listar tags do usuário
   */
  async list(): Promise<WaTag[]> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('wa_tags')
      .select('*')
      .order('name')
    
    if (error) throw new Error(error.message)
    return data || []
  },

  /**
   * Criar tag
   */
  async create(data: WaTagCreate): Promise<WaTag> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    
    const { data: tag, error } = await supabase
      .from('wa_tags')
      .insert({
        user_id: user.id,
        name: data.name,
        color: data.color || '#6B7280',
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return tag
  },

  /**
   * Deletar tag
   */
  async delete(id: string): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_tags')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

// ============================================
// Eventos
// ============================================
export const waEvents = {
  /**
   * Criar evento
   */
  async create(data: WaChatEventCreate): Promise<WaChatEvent> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data: event, error } = await supabase
      .from('wa_chat_events')
      .insert({
        session_id: data.session_id,
        chat_jid: data.chat_jid,
        kind: data.kind,
        user_id: data.user_id || null,
        user_email: data.user_email || null,
        detail: data.detail || null,
        ts: data.ts,
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return event
  },

  /**
   * Listar eventos de uma conversa
   */
  async list(sessionId: string, chatJid: string, limit = 50): Promise<WaChatEvent[]> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('wa_chat_events')
      .select('*')
      .eq('session_id', sessionId)
      .eq('chat_jid', chatJid)
      .order('ts', { ascending: true })
      .limit(limit)
    
    if (error) throw new Error(error.message)
    return data || []
  },
}

// ============================================
// Avaliações (CSAT)
// ============================================
export const waRatings = {
  /**
   * Criar avaliação
   */
  async create(data: WaRatingCreate): Promise<WaRating> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data: rating, error } = await supabase
      .from('wa_ratings')
      .insert({
        session_id: data.session_id,
        chat_jid: data.chat_jid,
        score: data.score,
        reply: data.reply || null,
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return rating
  },

  /**
   * Listar avaliações de uma sessão
   */
  async list(sessionId: string, limit = 100): Promise<WaRating[]> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('wa_ratings')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw new Error(error.message)
    return data || []
  },
}

// ============================================
// Mensagens Agendadas
// ============================================
export const waScheduledMessages = {
  /**
   * Agendar mensagem
   */
  async create(data: WaScheduledMessageCreate): Promise<WaScheduledMessage> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { data: message, error } = await supabase
      .from('wa_scheduled_messages')
      .insert({
        session_id: data.session_id,
        to_jid: data.to_jid,
        body: data.body,
        media_url: data.media_url || null,
        scheduled_at: data.scheduled_at,
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return message
  },

  /**
   * Listar mensagens agendadas
   */
  async list(sessionId?: string): Promise<WaScheduledMessage[]> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    let query = supabase
      .from('wa_scheduled_messages')
      .select('*')
      .order('scheduled_at', { ascending: true })
    
    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }
    
    const { data, error } = await query
    
    if (error) throw new Error(error.message)
    return data || []
  },

  /**
   * Cancelar mensagem agendada
   */
  async cancel(id: string): Promise<void> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('wa_scheduled_messages')
      .update({ status: 'cancelled' })
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

// ============================================
// Dashboard
// ============================================
export const waDashboard = {
  /**
   * Buscar estatísticas
   */
  async getStats(): Promise<WaDashboardStats> {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const [
      sessionsResult,
      contactsResult,
      chatsResult,
      ratingsResult,
    ] = await Promise.all([
      supabase.from('wa_sessions').select('id, status', { count: 'exact' }),
      supabase.from('wa_contacts').select('id', { count: 'exact' }),
      supabase.from('wa_chats').select('id, status'),
      supabase.from('wa_ratings').select('score'),
    ])
    
    const sessions = sessionsResult.data || []
    const contacts = contactsResult.data || []
    const chats = chatsResult.data || []
    const ratings = ratingsResult.data || []
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()
    
    const { count: messagesToday } = await supabase
      .from('wa_messages')
      .select('id', { count: 'exact' })
      .gte('timestamp', todayTimestamp)
    
    const avgResponseTime = 0 // TODO: Calcular tempo médio de resposta
    const avgCsat = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : 0
    
    return {
      total_sessions: sessions.length,
      connected_sessions: sessions.filter(s => s.status === 'connected').length,
      total_contacts: contacts.length,
      total_messages_today: messagesToday || 0,
      open_chats: chats.filter(c => c.status === 'open').length,
      waiting_chats: chats.filter(c => c.status === 'waiting').length,
      avg_response_time: avgResponseTime,
      csat_score: Math.round(avgCsat * 10) / 10,
    }
  },
}

// ============================================
// PIX Payments
// ============================================
const waPixPayments = {
  async create(data: WaPixPaymentCreate): Promise<WaPixPaymentResponse> {
    const { createClient } = await import('@/utils/supabase/server')
    const { createPixPayment, getPixQrCode } = await import('@/lib/asaas')
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get Asaas API key from payment_accounts
    const { data: paymentAccount } = await supabase
      .from('payment_accounts')
      .select('api_key, wallet_id')
      .eq('user_id', user.id)
      .eq('provider', 'asaas')
      .single()

    if (!paymentAccount?.api_key) throw new Error('Asaas not configured')

    const externalReference = `wa_${data.session_id}_${data.chat_jid}_${Date.now()}`
    const dueDate = new Date().toISOString().split('T')[0]

    const payment = await createPixPayment(
      {
        customer: data.customer_id || '',
        billingType: 'PIX',
        value: data.value,
        dueDate,
        description: data.description || 'Pagamento via WhatsApp',
        externalReference,
        split: paymentAccount.wallet_id
          ? [{ walletId: paymentAccount.wallet_id, percentualValue: 100 }]
          : undefined,
      },
      paymentAccount.api_key
    )

    const qrCode = await getPixQrCode(payment.id, paymentAccount.api_key)

    return {
      payment_id: payment.id,
      status: payment.status,
      value: payment.value,
      pix_qr_code: qrCode.encodedImage,
      pix_copy_paste: qrCode.payload,
      expiration_date: qrCode.expirationDate,
      invoice_url: payment.invoiceUrl,
    }
  },
}

// ============================================
// Export default
// ============================================
const waClient = {
  sessions: waSessions,
  messages: waMessages,
  contacts: waContacts,
  chats: waChats,
  queues: waQueues,
  quickReplies: waQuickReplies,
  tags: waTags,
  events: waEvents,
  ratings: waRatings,
  scheduledMessages: waScheduledMessages,
  dashboard: waDashboard,
  pix: waPixPayments,
}

export default waClient
