import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/wa/agent/config - Buscar config do agente
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('wa_agent_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return NextResponse.json({ config: data || null })
  } catch (error) {
    console.error('[WA Agent Config] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch config' },
      { status: 500 }
    )
  }
}

// POST /api/wa/agent/config - Criar/atualizar config do agente
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      session_id,
      is_enabled,
      provider,
      api_key,
      model,
      api_url,
      system_prompt,
      max_tokens,
      temperature,
      fallback_message,
      human_handoff_message,
    } = body

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      )
    }

    // Verificar ownership da sessão
    const { data: session } = await supabase
      .from('wa_sessions')
      .select('user_id')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('wa_agent_configs')
      .upsert({
        user_id: user.id,
        session_id,
        is_enabled: is_enabled ?? false,
        provider: provider || 'openai',
        api_key: api_key || null,
        model: model || 'gpt-4o',
        api_url: api_url || null,
        system_prompt: system_prompt || null,
        max_tokens: max_tokens || 1024,
        temperature: temperature || 0.7,
        fallback_message: fallback_message || null,
        human_handoff_message: human_handoff_message || null,
      }, { onConflict: 'user_id,session_id' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ config: data }, { status: 201 })
  } catch (error) {
    console.error('[WA Agent Config] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to save config' },
      { status: 500 }
    )
  }
}
