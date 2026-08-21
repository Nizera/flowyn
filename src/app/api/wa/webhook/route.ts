import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

const WA_WORKER_SECRET = process.env.WA_WORKER_SECRET || process.env.WORKER_SECRET || ''

// POST /api/wa/webhook - Receber eventos do WA Worker
export async function POST(req: NextRequest) {
  try {
    // Autenticação
    const authHeader = req.headers.get('authorization')
    if (!authHeader || authHeader !== `Bearer ${WA_WORKER_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const body = await req.json()
    const { type, data } = body

    if (!type || !data) {
      return NextResponse.json({ error: 'type and data are required' }, { status: 400 })
    }

    switch (type) {
      case 'connection_update':
      case 'session.connected':
      case 'session.disconnected':
        return handleConnectionUpdate(supabase, data, type)
      case 'message':
      case 'message.received':
        return handleMessage(supabase, data)
      case 'message_ack':
      case 'message.status':
        return handleMessageAck(supabase, data)
      case 'chat_update':
        return handleChatUpdate(supabase, data)
      case 'presence_update':
        return handlePresenceUpdate(supabase, data)
      case 'qr':
        return handleQR(supabase, data)
      default:
        console.warn('[WA Webhook] Unknown type:', type)
        return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error('[WA Webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}

async function handleConnectionUpdate(supabase: any, data: any, type: string) {
  const { sessionId, userId, status: rawStatus, phoneNumber } = data

  const targetSessionId = sessionId || userId

  if (!targetSessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  let newStatus: string
  if (type === 'session.connected' || rawStatus === 'connected') {
    newStatus = 'connected'
  } else if (type === 'session.disconnected' || rawStatus === 'logged_out') {
    newStatus = 'disconnected'
  } else {
    newStatus = rawStatus === 'connected' ? 'connected' : 'disconnected'
  }

  const update: Record<string, unknown> = { status: newStatus }
  if (phoneNumber) update.phone_number = phoneNumber
  if (newStatus === 'connected') update.jid = null

  await supabase
    .from('wa_sessions')
    .update(update)
    .eq('id', targetSessionId)

  return NextResponse.json({ success: true })
}

async function handleMessage(supabase: any, data: any) {
  const { sessionId, userId, message, phone, pushName, content, messageId, timestamp } = data

  const targetSessionId = sessionId || userId

  if (!targetSessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  // Support both old format (message object) and new format (flat fields from worker)
  const msgId = message?.id || messageId || crypto.randomUUID()
  const chatJid = message?.from || (phone ? `${phone}@s.whatsapp.net` : null)
  const isFromMe = message?.fromMe === true || message?.fromMe === 'true'
  const body = message?.body || content || ''
  const msgType = message?.type || 'text'
  const msgTimestamp = message?.timestamp || timestamp || Date.now()

  if (!chatJid) {
    return NextResponse.json({ error: 'chatJid required' }, { status: 400 })
  }

  // Insert message with valid status (pending, sent, delivered, read, failed)
  await supabase
    .from('wa_messages')
    .upsert({
      id: msgId,
      session_id: targetSessionId,
      chat_jid: chatJid,
      from_jid: isFromMe ? targetSessionId : chatJid,
      to_jid: isFromMe ? chatJid : targetSessionId,
      body,
      kind: msgType,
      media_url: message?.media || null,
      sender_name: pushName || message?.pushName || null,
      is_from_me: isFromMe,
      status: 'pending',
      timestamp: msgTimestamp,
    }, { onConflict: 'session_id,id' })

  // Update chat - increment unread_count for received messages
  const { data: existingChat } = await supabase
    .from('wa_chats')
    .select('unread_count')
    .eq('session_id', targetSessionId)
    .eq('chat_jid', chatJid)
    .single()

  const newUnread = isFromMe ? 0 : (existingChat?.unread_count || 0) + 1

  await supabase
    .from('wa_chats')
    .upsert({
      session_id: targetSessionId,
      chat_jid: chatJid,
      name: pushName || null,
      last_message: (body || '').substring(0, 100),
      last_message_at: msgTimestamp,
      unread_count: newUnread,
      status: 'open',
    }, { onConflict: 'session_id,chat_jid' })

  return NextResponse.json({ success: true })
}

async function handleMessageAck(supabase: any, data: any) {
  const { sessionId, userId, messageId, ack, status: workerStatus } = data

  if (!messageId) {
    return NextResponse.json({ error: 'messageId required' }, { status: 400 })
  }

  // Baileys ack values: 1=SENT, 2=DELIVERED, 3=READ, 4=PLAYED
  // Worker may also send pre-mapped status string
  let status: string
  if (workerStatus) {
    status = workerStatus
  } else if (ack === 1) {
    status = 'sent'
  } else if (ack === 2) {
    status = 'delivered'
  } else if (ack === 3) {
    status = 'read'
  } else {
    status = 'sent'
  }

  const targetSessionId = sessionId || userId

  await supabase
    .from('wa_messages')
    .update({ status })
    .eq('id', messageId)
    .eq('session_id', targetSessionId)

  return NextResponse.json({ success: true })
}

async function handleChatUpdate(supabase: any, data: any) {
  const { sessionId, chat } = data

  if (!sessionId || !chat) {
    return NextResponse.json({ error: 'sessionId and chat required' }, { status: 400 })
  }

  await supabase
    .from('wa_chats')
    .upsert({
      session_id: sessionId,
      chat_jid: chat.jid,
      name: chat.name || null,
      last_message: chat.lastMessage || null,
      last_message_at: chat.lastMessageAt || Date.now(),
      unread_count: chat.unreadCount || 0,
      is_group: chat.isGroup || false,
    }, { onConflict: 'session_id,chat_jid' })

  return NextResponse.json({ success: true })
}

async function handlePresenceUpdate(supabase: any, data: any) {
  // Presence updates are transient, no need to persist
  return NextResponse.json({ success: true })
}

async function handleQR(supabase: any, data: {
  sessionId: string
  qr: string
  attempt: number
}) {
  const { sessionId } = data

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  await supabase
    .from('wa_sessions')
    .update({ status: 'qr_pending' })
    .eq('id', sessionId)

  return NextResponse.json({ success: true })
}
