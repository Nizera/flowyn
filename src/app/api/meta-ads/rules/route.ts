import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { requireProPlan } from '@/lib/subscription'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { await requireProPlan(user.id) } catch {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const adAccountId = searchParams.get('ad_account_id')

  let query = supabase
    .from('automation_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (adAccountId) {
    query = query.eq('ad_account_id', adAccountId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rules: data || [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try { await requireProPlan(user.id) } catch {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const body = await req.json()
  const {
    ad_account_id, name, entity_level, entity_ids,
    condition_metric, condition_operator, condition_value, condition_period,
    action_type, action_value, action_value_type,
    cooldown_hours, notify_whatsapp, notify_email, webhook_url, webhook_secret,
  } = body

  if (!ad_account_id || !name || !condition_metric || !condition_operator || condition_value == null || !action_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const validMetrics = ['roas', 'spend', 'cpa', 'ctr', 'cpc', 'conversions', 'purchase_value', 'impressions', 'cpm']
  if (!validMetrics.includes(condition_metric)) {
    return NextResponse.json({ error: 'Invalid condition_metric' }, { status: 400 })
  }

  const validOperators = ['lt', 'lte', 'gt', 'gte', 'eq']
  if (!validOperators.includes(condition_operator)) {
    return NextResponse.json({ error: 'Invalid condition_operator' }, { status: 400 })
  }

  const validActions = ['pause', 'resume', 'increase_budget', 'decrease_budget', 'notify']
  if (!validActions.includes(action_type)) {
    return NextResponse.json({ error: 'Invalid action_type' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('automation_rules')
    .insert({
      user_id: user.id,
      ad_account_id,
      name,
      entity_level: entity_level || 'campaign',
      entity_ids: entity_ids || [],
      condition_metric,
      condition_operator,
      condition_value: Number(condition_value),
      condition_period: Number(condition_period) || 24,
      action_type,
      action_value: action_value != null ? Number(action_value) : null,
      action_value_type: action_value_type || 'percentage',
      cooldown_hours: Number(cooldown_hours) || 6,
      notify_whatsapp: Boolean(notify_whatsapp),
      notify_email: Boolean(notify_email),
      webhook_url: webhook_url || null,
      webhook_secret: webhook_secret || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rule: data }, { status: 201 })
}
