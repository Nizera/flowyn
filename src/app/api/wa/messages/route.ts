import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const WA_WORKER_URL = process.env.WA_WORKER_URL || 'http://localhost:3001'
const WA_WORKER_SECRET = process.env.WA_WORKER_SECRET || ''

// POST /api/wa/messages - Enviar mensagem
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { session_id, chat_jid, to_jid, body: messageBody, kind, media_url, quoted_id } = body

    if (!session_id || !chat_jid || !to_jid || !messageBody) {
      return NextResponse.json(
        { error: 'session_id, chat_jid, to_jid, and body are required' },
        { status: 400 }
      )
    }

    // Verificar se a sessão existe e pertence ao usuário
    const { data: session, error: sessionError } = await supabase
      .from('wa_sessions')
      .select('id, status, jid')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status !== 'connected') {
      return NextResponse.json(
        { error: 'Session is not connected' },
        { status: 400 }
      )
    }

    const messageId = crypto.randomUUID()
    const timestamp = Date.now()

    // Inserir mensagem no banco
    const { data: message, error: insertError } = await supabase
      .from('wa_messages')
      .insert({
        id: messageId,
        session_id,
        chat_jid,
        from_jid: session.jid || session_id,
        to_jid,
        body: messageBody,
        kind: kind || 'text',
        media_url: media_url || null,
        quoted_id: quoted_id || null,
        is_from_me: true,
        status: 'pending',
        timestamp,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Enviar via WA Worker (em background)
    fetch(`${WA_WORKER_URL}/api/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WA_WORKER_SECRET}`,
      },
      body: JSON.stringify({
        sessionId: session_id,
        to: to_jid,
        text: messageBody,
        media: media_url,
      }),
    }).catch(console.error)

    // Atualizar último mensagem do chat
    await supabase
      .from('wa_chats')
      .update({
        last_message: messageBody.substring(0, 100),
        last_message_at: timestamp,
      })
      .eq('session_id', session_id)
      .eq('chat_jid', chat_jid)

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error('[WA Messages] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
