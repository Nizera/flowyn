import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { requireProPlan } from '@/lib/subscription'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { await requireProPlan(user.id) } catch {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const body = await req.json()
  const adminSupabase = createAdminClient()

  const updates: Record<string, string | number | boolean | string[] | null> = { updated_at: new Date().toISOString() }
  if (body.enabled !== undefined) updates.enabled = body.enabled
  if (body.name !== undefined) updates.name = body.name
  if (body.condition_metric !== undefined) updates.condition_metric = body.condition_metric
  if (body.condition_operator !== undefined) updates.condition_operator = body.condition_operator
  if (body.condition_value !== undefined) updates.condition_value = Number(body.condition_value)
  if (body.condition_period !== undefined) updates.condition_period = Number(body.condition_period)
  if (body.action_type !== undefined) updates.action_type = body.action_type
  if (body.action_value !== undefined) updates.action_value = body.action_value != null ? Number(body.action_value) : null
  if (body.action_value_type !== undefined) updates.action_value_type = body.action_value_type
  if (body.entity_level !== undefined) updates.entity_level = body.entity_level
  if (body.entity_ids !== undefined) updates.entity_ids = body.entity_ids
  if (body.cooldown_hours !== undefined) updates.cooldown_hours = Number(body.cooldown_hours)
  if (body.notify_whatsapp !== undefined) updates.notify_whatsapp = Boolean(body.notify_whatsapp)
  if (body.notify_email !== undefined) updates.notify_email = Boolean(body.notify_email)
  if (body.webhook_url !== undefined) updates.webhook_url = body.webhook_url || null
  if (body.webhook_secret !== undefined) updates.webhook_secret = body.webhook_secret || null

  const { data, error } = await adminSupabase
    .from('automation_rules')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rule: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { await requireProPlan(user.id) } catch {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase
    .from('automation_rules')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
