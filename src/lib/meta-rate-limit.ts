import { createAdminClient } from '@/utils/supabase/admin'

// Meta Marketing API rate limits depend on Access Tier:
// - Limited access (development): ~60 points per 5 min per ad account
// - Full access (standard): ~9000 points per 5 min per ad account
// Read = 1 point, Write = 3 points
// Insights API has separate limits based on app-level and ad-account-level

type MetaRateLimitInfo = {
  app_id_util_pct: number
  acc_id_util_pct: number
  ads_api_access_tier: string
  estimated_time_to_regain_access?: number
  reset_time_duration?: number
}

type SyncBudget = {
  allowed: boolean
  callsRemaining: number
  tier: string
  throttlePercentage: number
  retryAfterSeconds?: number
}

// Parse X-Business-Use-Case-Usage or X-FB-Ads-Insights-Throttle header
export function parseMetaRateLimitHeader(headerValue: string | null): MetaRateLimitInfo | null {
  if (!headerValue) return null
  try {
    const parsed = JSON.parse(headerValue)
    // The header can be an array or single object
    const entry = Array.isArray(parsed) ? parsed[0] : parsed
    return {
      app_id_util_pct: entry.app_id_util_pct || 0,
      acc_id_util_pct: entry.acc_id_util_pct || 0,
      ads_api_access_tier: entry.ads_api_access_tier || 'unknown',
      estimated_time_to_regain_access: entry.estimated_time_to_regain_access,
      reset_time_duration: entry.reset_time_duration,
    }
  } catch {
    return null
  }
}

// Check if we can make more calls based on Meta's response headers
export function checkSyncBudget(rateLimitInfo: MetaRateLimitInfo | null): SyncBudget {
  if (!rateLimitInfo) {
    // No header = no info, allow with caution
    return { allowed: true, callsRemaining: 50, tier: 'unknown', throttlePercentage: 0 }
  }

  const throttlePct = Math.max(rateLimitInfo.app_id_util_pct, rateLimitInfo.acc_id_util_pct)

  // If utilization is above 80%, slow down
  if (throttlePct >= 100) {
    return {
      allowed: false,
      callsRemaining: 0,
      tier: rateLimitInfo.ads_api_access_tier,
      throttlePercentage: throttlePct,
      retryAfterSeconds: rateLimitInfo.estimated_time_to_regain_access
        ? rateLimitInfo.estimated_time_to_regain_access * 60
        : 300,
    }
  }

  if (throttlePct >= 80) {
    return {
      allowed: true,
      callsRemaining: Math.max(0, Math.floor((100 - throttlePct) / 10)),
      tier: rateLimitInfo.ads_api_access_tier,
      throttlePercentage: throttlePct,
      retryAfterSeconds: 30,
    }
  }

  return {
    allowed: true,
    callsRemaining: 100,
    tier: rateLimitInfo.ads_api_access_tier,
    throttlePercentage: throttlePct,
  }
}

// Track usage per ad account (not per user) since Meta limits are per ad account
export async function trackAdAccountUsage(
  userId: string,
  adAccountId: string,
  calls: number,
  rateLimitHeader: string | null
) {
  const supabase = createAdminClient()
  const rateLimitInfo = parseMetaRateLimitHeader(rateLimitHeader)

  await supabase.from('meta_api_usage').insert({
    user_id: userId,
    endpoint: 'sync-expanded',
    calls_made: calls,
    window_start: new Date().toISOString(),
  })

  // If we got rate limit info from Meta, log it for monitoring
  if (rateLimitInfo) {
    console.log(`[Meta Rate Limit] account=${adAccountId} tier=${rateLimitInfo.ads_api_access_tier} throttle=${rateLimitInfo.acc_id_util_pct}% app=${rateLimitInfo.app_id_util_pct}%`)
  }
}

// Get per-user total usage in current hour window
export async function getUserHourlyUsage(supabase: any, userId: string): Promise<number> {
  const { data } = await supabase
    .from('meta_api_usage')
    .select('calls_made')
    .eq('user_id', userId)
    .gte('window_start', new Date(new Date().setMinutes(0, 0, 0)).toISOString())

  return (data || []).reduce((sum: number, row: any) => sum + row.calls_made, 0)
}

// App-level limit: 200 calls × number of users (rolling 1 hour window)
// Conservative: assume up to 20 active users = 4000 calls/hour app total
// Individual sync makes 6 calls per account
export const APP_LEVEL_CALLS_LIMIT_PER_HOUR = 4000

// Check app-wide usage across ALL users (not per-user)
export async function checkAppLevelLimit(supabase: any): Promise<{ allowed: boolean; appUsage: number }> {
  const oneHourAgo = new Date(new Date().setMinutes(0, 0, 0)).toISOString()
  const { data } = await supabase
    .from('meta_api_usage')
    .select('calls_made')
    .gte('window_start', oneHourAgo)

  const appUsage = (data || []).reduce((sum: number, row: any) => sum + row.calls_made, 0)
  return {
    allowed: appUsage < APP_LEVEL_CALLS_LIMIT_PER_HOUR,
    appUsage,
  }
}
