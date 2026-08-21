import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const WA_WORKER_URL = process.env.WA_WORKER_URL || 'http://localhost:3001'
const WA_WORKER_SECRET = process.env.WA_WORKER_SECRET || process.env.WORKER_SECRET || ''

// POST /api/wa/sessions/[id]/logout - Desconectar sessão
export async function POST(
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

    // Chamar WA Worker para desconectar
    const response = await fetch(`${WA_WORKER_URL}/api/sessions/${id}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WA_WORKER_SECRET}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Worker error' }))
      return NextResponse.json(
        { error: errorData.message || 'Failed to logout session' },
        { status: response.status }
      )
    }

    // Atualizar status no banco
    await supabase
      .from('wa_sessions')
      .update({ status: 'disconnected' })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WA Sessions] LOGOUT error:', error)
    return NextResponse.json(
      { error: 'Failed to logout session' },
      { status: 500 }
    )
  }
}
