import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/wa/queues - Listar filas
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('wa_queues')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({ queues: data })
  } catch (error) {
    console.error('[WA Queues] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch queues' },
      { status: 500 }
    )
  }
}

// POST /api/wa/queues - Criar fila
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, color, distribution, max_load, greeting_message, out_of_hours_message, business_hours } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('wa_queues')
      .insert({
        user_id: user.id,
        name: name.trim(),
        color: color || '#25D366',
        distribution: distribution || 'manual',
        max_load: max_load || 10,
        greeting_message: greeting_message || null,
        out_of_hours_message: out_of_hours_message || null,
        business_hours: business_hours || {},
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ queue: data }, { status: 201 })
  } catch (error) {
    console.error('[WA Queues] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create queue' },
      { status: 500 }
    )
  }
}

// PUT /api/wa/queues - Atualizar fila
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, name, color, distribution, max_load, greeting_message, out_of_hours_message, business_hours } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (color !== undefined) updateData.color = color
    if (distribution !== undefined) updateData.distribution = distribution
    if (max_load !== undefined) updateData.max_load = max_load
    if (greeting_message !== undefined) updateData.greeting_message = greeting_message
    if (out_of_hours_message !== undefined) updateData.out_of_hours_message = out_of_hours_message
    if (business_hours !== undefined) updateData.business_hours = business_hours

    const { error } = await supabase
      .from('wa_queues')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WA Queues] PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update queue' },
      { status: 500 }
    )
  }
}

// DELETE /api/wa/queues?id=xxx - Deletar fila
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
      .from('wa_queues')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WA Queues] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete queue' },
      { status: 500 }
    )
  }
}
