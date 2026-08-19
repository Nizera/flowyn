import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/wa/quick-replies - Listar respostas rápidas
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('wa_quick_replies')
      .select('*')
      .eq('user_id', user.id)
      .order('shortcut', { ascending: true })

    if (error) throw error

    return NextResponse.json({ quick_replies: data })
  } catch (error) {
    console.error('[WA QuickReplies] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quick replies' },
      { status: 500 }
    )
  }
}

// POST /api/wa/quick-replies - Criar resposta rápida
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { shortcut, message, media_url, is_global } = body

    if (!shortcut || !message) {
      return NextResponse.json(
        { error: 'shortcut and message are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('wa_quick_replies')
      .insert({
        user_id: user.id,
        shortcut: shortcut.trim(),
        message,
        media_url: media_url || null,
        is_global: is_global || false,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Shortcut already exists' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ quick_reply: data }, { status: 201 })
  } catch (error) {
    console.error('[WA QuickReplies] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create quick reply' },
      { status: 500 }
    )
  }
}

// PUT /api/wa/quick-replies - Atualizar resposta rápida
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, shortcut, message, media_url, is_global } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (shortcut !== undefined) updateData.shortcut = shortcut.trim()
    if (message !== undefined) updateData.message = message
    if (media_url !== undefined) updateData.media_url = media_url
    if (is_global !== undefined) updateData.is_global = is_global

    const { error } = await supabase
      .from('wa_quick_replies')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WA QuickReplies] PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update quick reply' },
      { status: 500 }
    )
  }
}

// DELETE /api/wa/quick-replies?id=xxx - Deletar resposta rápida
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

    const { error } = await supabase
      .from('wa_quick_replies')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WA QuickReplies] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete quick reply' },
      { status: 500 }
    )
  }
}
