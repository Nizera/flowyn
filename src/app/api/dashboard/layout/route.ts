import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('dashboard_layouts')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ layout: data?.layout || [], visible_widgets: data?.visible_widgets || [] })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawBody = await req.text()
  if (rawBody.length > 16_384) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }
  const body = JSON.parse(rawBody)
  const { layout, visible_widgets } = body

  const { error } = await supabase
    .from('dashboard_layouts')
    .upsert({
      user_id: user.id,
      layout: layout || [],
      visible_widgets: visible_widgets || [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) {
    console.error('[Dashboard Layout] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
