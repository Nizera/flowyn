import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/wa/chats - Listar chats
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('session_id')
    const status = searchParams.get('status')
    const queueId = searchParams.get('queue_id')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Buscar session_ids do usuário para filtrar chats
    const { data: userSessions } = await supabase
      .from('wa_sessions')
      .select('id')
      .eq('user_id', user.id)

    const sessionIds = userSessions?.map(s => s.id) || []

    if (sessionIds.length === 0) {
      return NextResponse.json({ chats: [] })
    }

    let query = supabase
      .from('wa_chats')
      .select('*')
      .in('session_id', sessionIds)
      .order('last_message_at', { ascending: false })
      .limit(Math.min(limit, 100))

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (queueId) {
      query = query.eq('queue_id', queueId)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ chats: data })
  } catch (error) {
    console.error('[WA Chats] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    )
  }
}

// PUT /api/wa/chats - Atualizar chat
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, status, queue_id, assigned_user_id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    // Verificar ownership via session
    const { data: chat } = await supabase
      .from('wa_chats')
      .select('session_id')
      .eq('id', id)
      .single()

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const { data: session } = await supabase
      .from('wa_sessions')
      .select('user_id')
      .eq('id', chat.session_id)
      .single()

    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (queue_id !== undefined) updateData.queue_id = queue_id
    if (assigned_user_id !== undefined) updateData.assigned_user_id = assigned_user_id

    const { error } = await supabase
      .from('wa_chats')
      .update(updateData)
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WA Chats] PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update chat' },
      { status: 500 }
    )
  }
}
