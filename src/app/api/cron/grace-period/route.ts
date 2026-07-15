import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // 1. Suspend subscriptions past grace period
  const { data: expiredGrace } = await supabase
    .from('platform_subscriptions')
    .select('id, user_id')
    .eq('status', 'grace_period')
    .not('grace_period_ends_at', 'is', null)
    .lt('grace_period_ends_at', new Date().toISOString())

  let suspendedCount = 0
  for (const sub of expiredGrace || []) {
    try {
      await supabase
        .from('platform_subscriptions')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', sub.id)

      await supabase
        .from('profiles')
        .update({ plan: 'free', updated_at: new Date().toISOString() })
        .eq('id', sub.user_id)

      suspendedCount++
    } catch {
      continue
    }
  }

  return NextResponse.json({
    success: true,
    suspended: suspendedCount,
    timestamp: new Date().toISOString(),
  })
}
