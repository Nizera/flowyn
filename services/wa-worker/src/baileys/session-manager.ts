import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  WASocket,
  proto,
  jidNormalizedUser,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import path from 'path'
import fs from 'fs'
import { db, getSupabase } from '../lib/database'
import { createChildLogger } from '../lib/logger'
import { callFlowynWebhook } from '../webhook/flowyn-webhook'
import { getRandomDelay } from '../queue/rate-limiter'
import { config } from '../config'

const log = createChildLogger('session')

interface SessionInstance {
  userId: string
  sessionId: string
  socket: WASocket
  restartCount: number
  lastRestart: number
  messageQueue: MessageJob[]
  isProcessing: boolean
  qrCode: string | null
}

interface MessageJob {
  to: string
  content: string
  type: string
  mediaUrl?: string
  metadata?: Record<string, any>
  resolve: (result: any) => void
  reject: (error: any) => void
}

const instances = new Map<string, SessionInstance>()

export function getSessionCount(): number {
  return instances.size
}

export async function createSession(userId: string): Promise<{ status: string; qr?: string }> {
  if (instances.has(userId)) {
    log.warn({ userId }, 'Session already exists')
    return { status: 'already_connected' }
  }

  if (instances.size >= config.worker.maxSessionsPerWorker) {
    throw new Error('Worker at maximum capacity')
  }

  // Find or create session record in Supabase
  const supabase = getSupabase()
  let sessionId: string

  const { data: existingSession } = await supabase
    .from('wa_sessions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingSession) {
    sessionId = existingSession.id
  } else {
    // Create session via API (server-side)
    const { data: newSession, error } = await supabase
      .from('wa_sessions')
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        name: `WhatsApp ${userId.substring(0, 8)}`,
        status: 'connecting',
        integration_token: crypto.randomUUID(),
      })
      .select('id')
      .single()

    if (error) throw error
    sessionId = newSession.id
  }

  const authDir = path.join(process.cwd(), 'auth', userId)
  fs.mkdirSync(authDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const { version } = await fetchLatestBaileysVersion()

  let qrCode: string | null = null

  const socket = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, log as any),
    },
    printQRInTerminal: false,
    browser: ['Flowyn CRM', 'Chrome', '1.0.0'],
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    shouldIgnoreJid: () => false,
  })

  const instance: SessionInstance = {
    userId,
    sessionId,
    socket,
    restartCount: 0,
    lastRestart: Date.now(),
    messageQueue: [],
    isProcessing: false,
    qrCode: null,
  }

  socket.ev.on('creds.update', saveCreds)

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrCode = qr
      instance.qrCode = qr
      await supabase
        .from('wa_sessions')
        .update({ status: 'qr_pending' })
        .eq('id', sessionId)
      log.info({ userId }, 'QR Code generated')

      await callFlowynWebhook({
        event: 'qr',
        sessionId,
        userId,
        qr,
      })
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut

      log.warn({ userId, statusCode, shouldReconnect }, 'Connection closed')

      await supabase
        .from('wa_sessions')
        .update({ status: 'disconnected' })
        .eq('id', sessionId)

      if (shouldReconnect) {
        const delay = Math.min(30000, Math.pow(2, instance.restartCount) * 1000)
        log.info({ userId, delay }, 'Reconnecting...')
        setTimeout(() => reconnectSession(userId), delay)
      } else {
        await callFlowynWebhook({
          event: 'session.disconnected',
          sessionId,
          userId,
        })
        cleanupSession(userId)
      }
    }

    if (connection === 'open') {
      const phone = socket.user?.id?.replace(/:.*@/, '@')
      const phoneNumber = phone?.replace(/@.*$/, '').replace(/:/g, '')

      await supabase
        .from('wa_sessions')
        .update({
          status: 'connected',
          phone_number: phoneNumber || null,
        })
        .eq('id', sessionId)

      instance.restartCount = 0
      instance.qrCode = null
      log.info({ userId, phone: phoneNumber }, 'Connected')

      await callFlowynWebhook({
        event: 'session.connected',
        sessionId,
        userId,
        phoneNumber,
      })

      startMessageProcessor(instance)
    }
  })

  socket.ev.on('messages.upsert', async (msg) => {
    if (msg.type !== 'notify') return

    for (const m of msg.messages) {
      if (m.key.fromMe) continue
      if (!m.message) continue

      const from = m.key.remoteJid
      if (!from || !from.endsWith('@s.whatsapp.net')) continue

      const phone = from.replace(/@s.whatsapp.net$/, '')
      const content = extractMessageContent(m.message)
      const pushName = m.pushName || null

      // Save message to Supabase
      const msgId = m.key.id || crypto.randomUUID()
      await supabase
        .from('wa_messages')
        .upsert({
          id: msgId,
          session_id: sessionId,
          chat_jid: from,
          from_jid: from,
          to_jid: sessionId,
          body: content,
          kind: 'text',
          sender_name: pushName,
          is_from_me: false,
          status: 'pending',
          timestamp: typeof m.messageTimestamp === 'number' ? m.messageTimestamp * 1000 : Date.now(),
        }, { onConflict: 'session_id,id' })

      // Upsert chat
      const { data: existingChat } = await supabase
        .from('wa_chats')
        .select('unread_count')
        .eq('session_id', sessionId)
        .eq('chat_jid', from)
        .single()

      const newUnread = (existingChat?.unread_count || 0) + 1

      await supabase
        .from('wa_chats')
        .upsert({
          session_id: sessionId,
          chat_jid: from,
          name: pushName,
          last_message: content.substring(0, 100),
          last_message_at: Date.now(),
          unread_count: newUnread,
          status: 'waiting',
        }, { onConflict: 'session_id,chat_jid' })

      await callFlowynWebhook({
        event: 'message.received',
        sessionId,
        userId,
        phone,
        pushName,
        content,
        messageId: msgId,
        timestamp: m.messageTimestamp,
      })
    }
  })

  socket.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      if (!update.update.status) continue

      const statusMap: Record<number, string> = {
        1: 'sent',
        2: 'delivered',
        3: 'read',
        4: 'read',
      }

      const status = statusMap[update.update.status] || 'sent'

      if (update.key.id) {
        // Update message status in Supabase
        await supabase
          .from('wa_messages')
          .update({ status })
          .eq('id', update.key.id)
          .eq('session_id', sessionId)

        await callFlowynWebhook({
          event: 'message.status',
          sessionId,
          userId,
          messageId: update.key.id,
          status,
        })
      }
    }
  })

  instances.set(userId, instance)

  // Update session status to connecting
  await supabase
    .from('wa_sessions')
    .update({ status: 'qr_pending' })
    .eq('id', sessionId)

  return { status: 'connecting', qr: qrCode || undefined }
}

function extractMessageContent(message: proto.IMessage): string {
  if (message.conversation) return message.conversation
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text
  if (message.imageMessage?.caption) return message.imageMessage.caption
  if (message.videoMessage?.caption) return message.videoMessage.caption
  if (message.documentMessage?.fileName) return `[Document: ${message.documentMessage.fileName}]`
  if (message.audioMessage) return '[Audio]'
  if (message.stickerMessage) return '[Sticker]'
  if (message.locationMessage) return `[Location: ${message.locationMessage.name || ''}]`
  return '[Unsupported message type]'
}

function startMessageProcessor(instance: SessionInstance) {
  if (instance.isProcessing) return
  instance.isProcessing = true

  const processNext = async () => {
    if (instance.messageQueue.length === 0) {
      instance.isProcessing = false
      return
    }

    const job = instance.messageQueue.shift()!

    try {
      const jid = job.to.replace(/\D/g, '') + '@s.whatsapp.net'

      let sentMsg
      if (job.type === 'text') {
        sentMsg = await instance.socket.sendMessage(jid, { text: job.content })
      } else if (job.type === 'image' && job.mediaUrl) {
        sentMsg = await instance.socket.sendMessage(jid, {
          image: { url: job.mediaUrl },
          caption: job.content,
        })
      } else if (job.type === 'document' && job.mediaUrl) {
        sentMsg = await instance.socket.sendMessage(jid, {
          document: { url: job.mediaUrl },
          mimetype: 'application/pdf',
          fileName: job.content || 'document',
        })
      } else {
        sentMsg = await instance.socket.sendMessage(jid, { text: job.content })
      }

      // Update message status to sent
      const supabase = getSupabase()
      if (sentMsg?.key?.id) {
        await supabase
          .from('wa_messages')
          .update({ status: 'sent' })
          .eq('id', sentMsg.key.id)
          .eq('session_id', instance.sessionId)
      }

      job.resolve({
        success: true,
        messageId: sentMsg?.key?.id,
      })

      const delay = getRandomDelay()
      setTimeout(processNext, delay)
    } catch (err) {
      log.error(err, 'Failed to send message')
      job.reject(err)
      setTimeout(processNext, 1000)
    }
  }

  processNext()
}

export function sendMessage(
  userId: string,
  to: string,
  content: string,
  type: string = 'text',
  mediaUrl?: string,
  metadata?: Record<string, any>
): Promise<any> {
  return new Promise((resolve, reject) => {
    const instance = instances.get(userId)
    if (!instance) {
      reject(new Error('Session not found'))
      return
    }

    instance.messageQueue.push({ to, content, type, mediaUrl, metadata, resolve, reject })

    if (!instance.isProcessing) {
      startMessageProcessor(instance)
    }
  })
}

export function getStatus(userId: string) {
  const instance = instances.get(userId)
  if (!instance) return { status: 'disconnected' }

  return {
    status: 'connected',
    phoneNumber: instance.socket.user?.id,
    queueSize: instance.messageQueue.length,
    restartCount: instance.restartCount,
  }
}

export function getQRCode(userId: string): string | null {
  const instance = instances.get(userId)
  if (!instance) return null
  return instance.qrCode
}

async function reconnectSession(userId: string) {
  const instance = instances.get(userId)
  if (!instance) return

  instance.restartCount++
  instance.lastRestart = Date.now()

  try {
    instance.socket.end(undefined)
  } catch {}

  instances.delete(userId)

  await createSession(userId)
}

function cleanupSession(userId: string) {
  const instance = instances.get(userId)
  if (!instance) return

  try {
    instance.socket.end(undefined)
  } catch {}

  instances.delete(userId)

  const authDir = path.join(process.cwd(), 'auth', userId)
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true })
  }
}

export async function disconnectSession(userId: string) {
  const instance = instances.get(userId)
  const sessionId = instance?.sessionId

  cleanupSession(userId)

  if (sessionId) {
    const supabase = getSupabase()
    await supabase
      .from('wa_sessions')
      .update({ status: 'disconnected' })
      .eq('id', sessionId)

    await callFlowynWebhook({
      event: 'session.disconnected',
      sessionId,
      userId,
    })
  }
}

// Get session ID for a user
export function getSessionId(userId: string): string | null {
  const instance = instances.get(userId)
  return instance?.sessionId || null
}

setInterval(async () => {
  const now = Date.now()
  const restartMs = config.worker.sessionRestartHours * 60 * 60 * 1000

  for (const [userId, instance] of instances.entries()) {
    if (now - instance.lastRestart > restartMs) {
      log.info({ userId }, 'Scheduled session restart')
      await reconnectSession(userId)
    }
  }
}, 5 * 60 * 1000)
