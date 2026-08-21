import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const WA_WORKER_URL = process.env.WA_WORKER_URL || 'http://localhost:3001'
const WA_WORKER_SECRET = process.env.WA_WORKER_SECRET || process.env.WORKER_SECRET || ''

// GET /api/wa/sessions - Listar sessões
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('wa_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ sessions: data })
  } catch (error) {
    console.error('[WA Sessions] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

// POST /api/wa/sessions - Criar sessão
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, phone_number, color, is_default, allow_groups, queue_id, greeting_message, completion_message, out_of_hours_message } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const id = crypto.randomUUID()
    const integration_token = crypto.randomUUID()

    const { data: session, error } = await supabase
      .from('wa_sessions')
      .insert({
        id,
        user_id: user.id,
        name: name.trim(),
        phone_number: phone_number || null,
        color: color || '#25D366',
        is_default: is_default || false,
        allow_groups: allow_groups || false,
        queue_id: queue_id || null,
        greeting_message: greeting_message || null,
        completion_message: completion_message || null,
        out_of_hours_message: out_of_hours_message || null,
        integration_token,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    console.error('[WA Sessions] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
