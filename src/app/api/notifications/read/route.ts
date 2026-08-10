import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { notification_ids?: string[]; mark_all?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { notification_ids, mark_all } = body

  if (mark_all) {
    const { error } = await supabase
      .from('in_app_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) {
      return NextResponse.json({ error: 'Failed to mark notifications' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
    return NextResponse.json({ error: 'Missing notification_ids' }, { status: 400 })
  }

  const { error } = await supabase
    .from('in_app_notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .in('id', notification_ids)

  if (error) {
    return NextResponse.json({ error: 'Failed to mark notifications' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
