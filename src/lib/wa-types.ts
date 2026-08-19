// ============================================
// WhatsApp CRM - Tipos TypeScript
// ============================================

// ============================================
// Sessões WhatsApp
// ============================================
export type WaSessionStatus = 'disconnected' | 'qr_pending' | 'connected'

export interface WaSession {
  id: string
  user_id: string
  name: string
  phone_number: string | null
  status: WaSessionStatus
  jid: string | null
  integration_token: string
  color: string
  is_default: boolean
  allow_groups: boolean
  queue_id: string | null
  greeting_message: string | null
  completion_message: string | null
  out_of_hours_message: string | null
  created_at: string
  updated_at: string
}

export interface WaSessionCreate {
  name: string
  phone_number?: string
  color?: string
  is_default?: boolean
  allow_groups?: boolean
  queue_id?: string
  greeting_message?: string
  completion_message?: string
  out_of_hours_message?: string
}

export interface WaSessionUpdate {
  name?: string
  phone_number?: string
  status?: WaSessionStatus
  jid?: string
  color?: string
  is_default?: boolean
  allow_groups?: boolean
  queue_id?: string
  greeting_message?: string
  completion_message?: string
  out_of_hours_message?: string
}

// ============================================
// Mensagens
// ============================================
export type WaMessageKind = 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact'
export type WaMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface WaMessage {
  id: string
  session_id: string
  chat_jid: string
  from_jid: string
  to_jid: string
  body: string
  kind: WaMessageKind
  media_url: string | null
  media_mime: string | null
  file_name: string | null
  file_size: number | null
  quoted_id: string | null
  sender_name: string | null
  is_from_me: boolean
  status: WaMessageStatus
  timestamp: number
  created_at: string
}

export interface WaMessageCreate {
  session_id: string
  chat_jid: string
  to_jid: string
  body: string
  kind?: WaMessageKind
  media_url?: string
  quoted_id?: string
}

// ============================================
// Contatos
// ============================================
export interface WaContact {
  id: string
  user_id: string
  phone: string
  name: string | null
  push_name: string | null
  avatar_url: string | null
  email: string | null
  tags: string[]
  is_group: boolean
  last_seen: string | null
  created_at: string
  updated_at: string
}

export interface WaContactCreate {
  phone: string
  name?: string
  push_name?: string
  avatar_url?: string
  email?: string
  tags?: string[]
  is_group?: boolean
}

export interface WaContactUpdate {
  name?: string
  push_name?: string
  avatar_url?: string
  email?: string
  tags?: string[]
}

// ============================================
// Chats (Metadados das conversas)
// ============================================
export type WaChatStatus = 'waiting' | 'open' | 'closed' | 'group'

export interface WaChat {
  id: string
  session_id: string
  chat_jid: string
  name: string | null
  is_group: boolean
  status: WaChatStatus
  assigned_user_id: string | null
  queue_id: string | null
  last_message: string | null
  last_message_at: number | null
  unread_count: number
  created_at: string
  updated_at: string
}

export interface WaChatUpdate {
  name?: string
  status?: WaChatStatus
  assigned_user_id?: string
  queue_id?: string
  last_message?: string
  last_message_at?: number
  unread_count?: number
}

// ============================================
// Filas de Atendimento
// ============================================
export type WaQueueDistribution = 'manual' | 'round-robin'

export interface WaQueue {
  id: string
  user_id: string
  name: string
  color: string
  distribution: WaQueueDistribution
  max_load: number
  greeting_message: string | null
  out_of_hours_message: string | null
  business_hours: Record<string, { open: string; close: string }> | null
  created_at: string
  updated_at: string
}

export interface WaQueueCreate {
  name: string
  color?: string
  distribution?: WaQueueDistribution
  max_load?: number
  greeting_message?: string
  out_of_hours_message?: string
  business_hours?: Record<string, { open: string; close: string }>
}

export interface WaQueueUpdate {
  name?: string
  color?: string
  distribution?: WaQueueDistribution
  max_load?: number
  greeting_message?: string
  out_of_hours_message?: string
  business_hours?: Record<string, { open: string; close: string }>
}

// ============================================
// Membros das Filas (Agentes)
// ============================================
export interface WaQueueMember {
  id: string
  queue_id: string
  user_id: string
  max_load: number
  is_active: boolean
  created_at: string
}

export interface WaQueueMemberCreate {
  queue_id: string
  user_id: string
  max_load?: number
  is_active?: boolean
}

// ============================================
// Eventos do Ciclo de Vida
// ============================================
export type WaChatEventKind = 'created' | 'opened' | 'closed' | 'reassigned' | 'transferred' | 'note'

export interface WaChatEvent {
  id: number
  session_id: string
  chat_jid: string
  kind: WaChatEventKind
  user_id: string | null
  user_email: string | null
  detail: string | null
  ts: number
}

export interface WaChatEventCreate {
  session_id: string
  chat_jid: string
  kind: WaChatEventKind
  user_id?: string
  user_email?: string
  detail?: string
  ts: number
}

// ============================================
// Pesquisas de Satisfação (CSAT)
// ============================================
export type WaRatingScore = 1 | 2 | 3 // 1=Bom, 2=Regular, 3=Ruim

export interface WaRating {
  id: number
  session_id: string
  chat_jid: string
  score: WaRatingScore
  reply: string | null
  created_at: string
}

export interface WaRatingCreate {
  session_id: string
  chat_jid: string
  score: WaRatingScore
  reply?: string
}

// ============================================
// Respostas Rápidas
// ============================================
export interface WaQuickReply {
  id: string
  user_id: string
  shortcut: string
  message: string
  media_url: string | null
  is_global: boolean
  created_at: string
}

export interface WaQuickReplyCreate {
  shortcut: string
  message: string
  media_url?: string
  is_global?: boolean
}

// ============================================
// Tags
// ============================================
export interface WaTag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface WaTagCreate {
  name: string
  color?: string
}

// ============================================
// Mensagens Agendadas
// ============================================
export type WaScheduledMessageStatus = 'pending' | 'sent' | 'failed' | 'cancelled'

export interface WaScheduledMessage {
  id: string
  user_id: string
  session_id: string
  to_jid: string
  body: string
  media_url: string | null
  scheduled_at: string
  status: WaScheduledMessageStatus
  created_at: string
}

export interface WaScheduledMessageCreate {
  session_id: string
  to_jid: string
  body: string
  media_url?: string
  scheduled_at: string
}

// ============================================
// API Response Types
// ============================================
export interface WaApiResponse<T> {
  data: T | null
  error: string | null
}

export interface WaPaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

// ============================================
// Webhook Event Types
// ============================================
export type WaWebhookEventType = 
  | 'message.received'
  | 'message.sent'
  | 'message.status'
  | 'session.status'
  | 'session.qr'
  | 'contact.sync'

export interface WaWebhookEvent {
  type: WaWebhookEventType
  session_id: string
  timestamp: number
  data: Record<string, unknown>
}

export interface WaWebhookMessageEvent extends WaWebhookEvent {
  type: 'message.received' | 'message.sent'
  data: {
    message_id: string
    chat_jid: string
    from_jid: string
    to_jid: string
    body: string
    kind: WaMessageKind
    media_url?: string
    is_from_me: boolean
  }
}

export interface WaWebhookSessionEvent extends WaWebhookEvent {
  type: 'session.status' | 'session.qr'
  data: {
    status?: WaSessionStatus
    qr_code?: string
    phone_number?: string
  }
}

export interface WaWebhookContactEvent extends WaWebhookEvent {
  type: 'contact.sync'
  data: {
    phone: string
    name?: string
    push_name?: string
    avatar_url?: string
  }
}

// ============================================
// Chat Summary (para UI)
// ============================================
export interface WaChatSummary {
  chat_jid: string
  name: string | null
  phone: string | null
  avatar_url: string | null
  is_group: boolean
  status: WaChatStatus
  last_message: string | null
  last_message_at: number | null
  unread_count: number
  assigned_user_id: string | null
  queue_id: string | null
}

// ============================================
// Dashboard Stats
// ============================================
export interface WaDashboardStats {
  total_sessions: number
  connected_sessions: number
  total_contacts: number
  total_messages_today: number
  open_chats: number
  waiting_chats: number
  avg_response_time: number // em minutos
  csat_score: number // média de 1-3
}

// ============================================
// Pagamentos PIX via WhatsApp
// ============================================
export type WaPixPaymentStatus = 'pending' | 'confirmed' | 'failed' | 'refunded'

export interface WaPixPayment {
  id: string
  session_id: string
  chat_jid: string
  user_id: string
  value: number
  status: WaPixPaymentStatus
  external_reference: string | null
  product_id: string | null
  plan_id: string | null
  asaas_payment_id: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
}

export interface WaPixPaymentCreate {
  session_id: string
  chat_jid: string
  value: number
  description?: string
  product_id?: string
  plan_id?: string
  customer_id?: string
}

export interface WaPixPaymentResponse {
  payment_id: string
  status: string
  value: number
  pix_qr_code: string
  pix_copy_paste: string
  expiration_date: string
  invoice_url?: string
}

// ============================================
// Agente IA
// ============================================
export type WaAgentProvider = 'openai' | 'anthropic' | 'google' | 'nvidia' | 'custom'

export interface WaAgentConfig {
  id: string
  user_id: string
  session_id: string
  is_enabled: boolean
  provider: WaAgentProvider
  api_key: string | null
  model: string
  api_url: string | null
  system_prompt: string | null
  max_tokens: number
  temperature: number
  fallback_message: string
  human_handoff_message: string
  created_at: string
  updated_at: string
}

export interface WaAgentConfigCreate {
  session_id: string
  is_enabled?: boolean
  provider?: WaAgentProvider
  api_key?: string
  model?: string
  api_url?: string
  system_prompt?: string
  max_tokens?: number
  temperature?: number
  fallback_message?: string
  human_handoff_message?: string
}

// ============================================
// Skills
// ============================================
export type WaSkillTriggerType = 'keyword' | 'intent' | 'regex' | 'manual'
export type WaSkillActionType = 'message' | 'pix' | 'checkout' | 'webhook' | 'transfer' | 'custom'

export interface WaSkill {
  id: string
  user_id: string | null
  name: string
  slug: string
  description: string | null
  content: string | null
  is_system: boolean
  is_enabled: boolean
  trigger_type: WaSkillTriggerType
  trigger_config: Record<string, unknown>
  action_type: WaSkillActionType
  action_config: Record<string, unknown>
  priority: number
  created_at: string
  updated_at: string
}

export interface WaSkillCreate {
  name: string
  slug: string
  description?: string
  content?: string
  is_enabled?: boolean
  trigger_type?: WaSkillTriggerType
  trigger_config?: Record<string, unknown>
  action_type?: WaSkillActionType
  action_config?: Record<string, unknown>
  priority?: number
}

// ============================================
// Contexto da Conversa
// ============================================
export interface WaConversationContext {
  id: string
  session_id: string
  chat_jid: string
  context: Record<string, unknown>
  last_skill_used: string | null
  last_intent: string | null
  messages_count: number
  created_at: string
  updated_at: string
}

// ============================================
// Request/Response do Agente
// ============================================
export interface WaAgentProcessRequest {
  session_id: string
  chat_jid: string
  message: string
  contact_name?: string
  product_id?: string
}

export interface WaAgentProcessResponse {
  action: 'reply' | 'pix' | 'checkout' | 'transfer' | 'webhook'
  message?: string
  pix_data?: {
    value: number
    description: string
    product_id?: string
  }
  checkout_url?: string
  transfer_reason?: string
  webhook_url?: string
  skill_used?: string
  confidence?: number
}
