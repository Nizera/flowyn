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

  if (layout !== undefined && (!Array.isArray(layout) || layout.length > 50)) {
    return NextResponse.json({ error: 'Invalid layout' }, { status: 400 })
  }
  if (visible_widgets !== undefined && (!Array.isArray(visible_widgets) || visible_widgets.length > 50)) {
    return NextResponse.json({ error: 'Invalid visible_widgets' }, { status: 400 })
  }

  const safeLayout = Array.isArray(layout) ? layout.map((w: Record<string, unknown>) => ({
    i: typeof w.i === 'string' ? w.i.slice(0, 100) : '',
    x: typeof w.x === 'number' ? w.x : 0,
    y: typeof w.y === 'number' ? w.y : 0,
    w: typeof w.w === 'number' ? w.w : 1,
    h: typeof w.h === 'number' ? w.h : 1,
  })) : []
  const safeWidgets = Array.isArray(visible_widgets) ? visible_widgets.filter((w: unknown) => typeof w === 'string').map((w: string) => w.slice(0, 100)) : []

  const { error } = await supabase
    .from('dashboard_layouts')
    .upsert({
      user_id: user.id,
      layout: safeLayout,
      visible_widgets: safeWidgets,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) {
    console.error('[Dashboard Layout] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
