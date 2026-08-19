import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/wa/messages/[sessionId]/[chatJid] - Listar mensagens
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; chatJid: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, chatJid } = await params

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const before = searchParams.get('before')

    // Verificar se a sessão existe e pertence ao usuário
    const { data: session, error: sessionError } = await supabase
      .from('wa_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    let query = supabase
      .from('wa_messages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('chat_jid', chatJid)
      .order('timestamp', { ascending: true })
      .limit(Math.min(limit, 500))

    if (before) {
      query = query.lt('timestamp', parseInt(before))
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ messages: data })
  } catch (error) {
    console.error('[WA Messages] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
