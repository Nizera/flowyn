import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/wa/skills - Listar skills
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('wa_skills')
      .select('*')
      .or(`user_id.eq.${user.id},is_system.eq.true`)
      .order('priority', { ascending: false })

    if (error) throw error

    return NextResponse.json({ skills: data })
  } catch (error) {
    console.error('[WA Skills] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch skills' },
      { status: 500 }
    )
  }
}

// POST /api/wa/skills - Criar skill customizada
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      name,
      slug,
      description,
      content,
      trigger_type,
      trigger_config,
      action_type,
      action_config,
      priority,
    } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'name and slug are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('wa_skills')
      .insert({
        user_id: user.id,
        name,
        slug,
        description: description || null,
        content: content || null,
        is_system: false,
        is_enabled: true,
        trigger_type: trigger_type || 'keyword',
        trigger_config: trigger_config || {},
        action_type: action_type || 'message',
        action_config: action_config || {},
        priority: priority || 0,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Slug already exists' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ skill: data }, { status: 201 })
  } catch (error) {
    console.error('[WA Skills] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create skill' },
      { status: 500 }
    )
  }
}

// PUT /api/wa/skills - Atualizar skill
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      id,
      name,
      description,
      content,
      is_enabled,
      trigger_type,
      trigger_config,
      action_type,
      action_config,
      priority,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    // Verificar se não é skill do sistema
    const { data: existing } = await supabase
      .from('wa_skills')
      .select('is_system')
      .eq('id', id)
      .single()

    if (existing?.is_system) {
      return NextResponse.json(
        { error: 'Cannot modify system skills' },
        { status: 403 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (content !== undefined) updateData.content = content
    if (is_enabled !== undefined) updateData.is_enabled = is_enabled
    if (trigger_type !== undefined) updateData.trigger_type = trigger_type
    if (trigger_config !== undefined) updateData.trigger_config = trigger_config
    if (action_type !== undefined) updateData.action_type = action_type
    if (action_config !== undefined) updateData.action_config = action_config
    if (priority !== undefined) updateData.priority = priority

    const { error } = await supabase
      .from('wa_skills')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WA Skills] PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update skill' },
      { status: 500 }
    )
  }
}

// DELETE /api/wa/skills?id=xxx - Deletar skill
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    // Verificar se não é skill do sistema
    const { data: existing } = await supabase
      .from('wa_skills')
      .select('is_system')
      .eq('id', id)
      .single()

    if (existing?.is_system) {
      return NextResponse.json(
        { error: 'Cannot delete system skills' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('wa_skills')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WA Skills] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete skill' },
      { status: 500 }
    )
  }
}
