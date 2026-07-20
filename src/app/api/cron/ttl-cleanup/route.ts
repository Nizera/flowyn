import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { safeBearerCompare } from '@/lib/safe-bearer-compare'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || ''
  const cronSecret = process.env.CRN_SECRET || process.env.CRON_SECRET

  if (!cronSecret || !safeBearerCompare(authHeader, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const results: Record<string, number> = {}

  // Clean sync_logs older than 90 days
  const cutoffSync = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { count: syncCount } = await supabase
    .from('sync_logs')
    .select('id', { count: 'exact', head: true })
    .lt('created_at', cutoffSync)
  if (syncCount && syncCount > 0) {
    await supabase.from('sync_logs').delete().lt('created_at', cutoffSync)
  }
  results.sync_logs = syncCount || 0

  // Clean tracking_events older than 180 days
  const cutoffTracking = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString()
  const { count: trackingCount } = await supabase
    .from('tracking_events')
    .select('id', { count: 'exact', head: true })
    .lt('created_at', cutoffTracking)
  if (trackingCount && trackingCount > 0) {
    await supabase.from('tracking_events').delete().lt('created_at', cutoffTracking)
  }
  results.tracking_events = trackingCount || 0

  // Clean funnel_events older than 180 days
  const { count: funnelCount } = await supabase
    .from('funnel_events')
    .select('id', { count: 'exact', head: true })
    .lt('created_at', cutoffTracking)
  if (funnelCount && funnelCount > 0) {
    await supabase.from('funnel_events').delete().lt('created_at', cutoffTracking)
  }
  results.funnel_events = funnelCount || 0

  console.log('[TTL Cleanup]', results)

  return NextResponse.json({ success: true, cleaned: results })
}
