import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { verifyOrigin } from '@/lib/csrf'

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
  const csrfError = verifyOrigin(req)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawBody = await req.text()
  if (rawBody.length > 16_384) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }
  const { layout, visible_widgets } = body as { layout?: unknown[]; visible_widgets?: string[] }

  if (layout !== undefined && (!Array.isArray(layout) || layout.length > 50)) {
    return NextResponse.json({ error: 'Invalid layout' }, { status: 400 })
  }
  if (visible_widgets !== undefined && (!Array.isArray(visible_widgets) || visible_widgets.length > 50)) {
    return NextResponse.json({ error: 'Invalid visible_widgets' }, { status: 400 })
  }

  const safeLayout = Array.isArray(layout) ? layout.map((w: unknown) => {
    const widget = w as Record<string, unknown>
    return {
      i: typeof widget.i === 'string' ? widget.i.slice(0, 100) : '',
      x: typeof widget.x === 'number' ? widget.x : 0,
      y: typeof widget.y === 'number' ? widget.y : 0,
      w: typeof widget.w === 'number' ? widget.w : 1,
      h: typeof widget.h === 'number' ? widget.h : 1,
    }
  }) : []
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
