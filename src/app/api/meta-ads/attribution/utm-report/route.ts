import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { requireProPlan } from '@/lib/subscription'

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
    const { ad_account_id, start_date, end_date, group_by } = body

    if (!ad_account_id || !start_date || !end_date) {
      return NextResponse.json({ error: 'ad_account_id, start_date, end_date required' }, { status: 400 })
    }

    // Fetch attributions for this account and period
    const { data: attributions, error } = await supabase
      .from('order_attributions')
      .select('campaign_id, utm_source, utm_medium, utm_content, click_id_type, attributed_revenue')
      .eq('ad_account_id', ad_account_id)
      .eq('user_id', user.id)
      .gte('created_at', start_date)
      .lte('created_at', end_date + 'T23:59:59')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch campaign names
    const campaignIds = [...new Set((attributions || []).map(a => a.campaign_id))]
    const { data: campaigns } = campaignIds.length > 0
      ? await supabase
          .from('campaigns')
          .select('campaign_id, name')
          .in('campaign_id', campaignIds)
      : { data: [] }

    const campaignNames: Record<string, string> = {}
    for (const c of campaigns || []) {
      campaignNames[c.campaign_id] = c.name
    }

    // Group by the requested dimension
    const dimension = group_by || 'utm_source'
    const grouped: Record<string, { revenue: number; orders: number }> = {}

    for (const attr of attributions || []) {
      let key: string

      switch (dimension) {
        case 'utm_source':
          key = attr.utm_source || 'direct'
          break
        case 'utm_medium':
          key = attr.utm_medium || 'none'
          break
        case 'utm_content':
          key = attr.utm_content || 'none'
          break
        case 'campaign':
          key = campaignNames[attr.campaign_id] || attr.campaign_id
          break
        case 'click_id':
          key = attr.click_id_type || 'none'
          break
        default:
          key = attr.utm_source || 'direct'
      }

      if (!grouped[key]) {
        grouped[key] = { revenue: 0, orders: 0 }
      }
      grouped[key].revenue += parseFloat(attr.attributed_revenue) || 0
      grouped[key].orders += 1
    }

    // Sort by revenue descending
    const results = Object.entries(grouped)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)

    return NextResponse.json({
      dimension,
      results,
      period: { start_date, end_date },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
