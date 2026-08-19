import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/wa/dashboard/stats - Estatísticas do dashboard
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar session_ids do usuário
    const { data: userSessions } = await supabase
      .from('wa_sessions')
      .select('id')
      .eq('user_id', user.id)

    const sessionIds = userSessions?.map(s => s.id) || []

    if (sessionIds.length === 0) {
      return NextResponse.json({
        stats: {
          active_sessions: 0,
          messages_today: 0,
          active_chats: 0,
          unread_messages: 0,
          closed_today: 0,
          waiting_chats: 0,
        }
      })
    }

    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const today = new Date()

    const [
      sessionsResult,
      messagesResult,
      chatsResult,
      unreadResult,
      closedResult,
      waitingResult,
    ] = await Promise.all([
      // Sessões ativas
      supabase
        .from('wa_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'connected'),

      // Mensagens hoje (via session_ids)
      supabase
        .from('wa_messages')
        .select('id', { count: 'exact', head: true })
        .in('session_id', sessionIds)
        .gte('timestamp', oneDayAgo),

      // Chats abertos
      supabase
        .from('wa_chats')
        .select('id', { count: 'exact', head: true })
        .in('session_id', sessionIds)
        .eq('status', 'open'),

      // Não lidas
      supabase
        .from('wa_chats')
        .select('id', { count: 'exact', head: true })
        .in('session_id', sessionIds)
        .gt('unread_count', 0),

      // Fechados hoje
      supabase
        .from('wa_chats')
        .select('id', { count: 'exact', head: true })
        .in('session_id', sessionIds)
        .eq('status', 'closed')
        .gte('updated_at', new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()),

      // Aguardando
      supabase
        .from('wa_chats')
        .select('id', { count: 'exact', head: true })
        .in('session_id', sessionIds)
        .eq('status', 'waiting'),
    ])

    const stats = {
      active_sessions: sessionsResult.count || 0,
      messages_today: messagesResult.count || 0,
      active_chats: chatsResult.count || 0,
      unread_messages: unreadResult.count || 0,
      closed_today: closedResult.count || 0,
      waiting_chats: waitingResult.count || 0,
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('[WA Dashboard] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
