import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { requireProPlan } from '@/lib/subscription'
import { materializeOrderAttributions } from '@/lib/order-attribution'

// POST: Materialize order attributions for the user
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireProPlan(user.id)
  } catch {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { start_date, end_date } = body

    if (!start_date || !end_date) {
      return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 })
    }

    const result = await materializeOrderAttributions(user.id, start_date, end_date)

    return NextResponse.json({
      success: true,
      created: result.created,
      skipped: result.skipped,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}

// GET: Return attribution summary for the user
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireProPlan(user.id)
  } catch {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  try {
    const { data: attributions } = await supabase
      .from('order_attributions')
      .select('id, campaign_id, attributed_revenue')
      .eq('user_id', user.id)

    const totalAttributions = attributions?.length || 0
    const totalRevenue = (attributions || []).reduce((sum, a) => sum + (parseFloat(a.attributed_revenue) || 0), 0)

    return NextResponse.json({
      total_attributions: totalAttributions,
      total_attributed_revenue: totalRevenue,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
