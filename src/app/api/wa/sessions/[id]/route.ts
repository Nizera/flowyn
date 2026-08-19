import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const WA_WORKER_URL = process.env.WA_WORKER_URL || 'http://localhost:3001'
const WA_WORKER_SECRET = process.env.WA_WORKER_SECRET || ''

// GET /api/wa/sessions/[id] - Buscar sessão
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const { data, error } = await supabase
      .from('wa_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({ session: data })
  } catch (error) {
    console.error('[WA Sessions] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}

// PUT /api/wa/sessions/[id] - Atualizar sessão
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { name, phone_number, color, is_default, allow_groups, queue_id, greeting_message, completion_message, out_of_hours_message } = body

    const { error } = await supabase
      .from('wa_sessions')
      .update({
        ...(name !== undefined && { name: name.trim() }),
        ...(phone_number !== undefined && { phone_number }),
        ...(color !== undefined && { color }),
        ...(is_default !== undefined && { is_default }),
        ...(allow_groups !== undefined && { allow_groups }),
        ...(queue_id !== undefined && { queue_id }),
        ...(greeting_message !== undefined && { greeting_message }),
        ...(completion_message !== undefined && { completion_message }),
        ...(out_of_hours_message !== undefined && { out_of_hours_message }),
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WA Sessions] PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}

// DELETE /api/wa/sessions/[id] - Deletar sessão
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verificar se a sessão existe e pertence ao usuário
    const { data: session, error: fetchError } = await supabase
      .from('wa_sessions')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Tentar desconectar do WA Worker primeiro
    try {
      await fetch(`${WA_WORKER_URL}/api/sessions/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${WA_WORKER_SECRET}`,
        },
      })
    } catch (workerError) {
      console.error('[WA Sessions] Worker delete error:', workerError)
      // Continuar mesmo se o worker falhar
    }

    // Deletar do banco
    const { error } = await supabase
      .from('wa_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WA Sessions] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
