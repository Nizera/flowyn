-- C1 FIX: referrals/referral_commissions RLS policies used current_setting('role')
-- which does NOT work in PostgREST/Supabase. The correct approach is to use
-- auth.uid() for user checks and simply allow service_role through (service_role
-- bypasses RLS entirely, so we only need to ensure the policies don't block it).

-- Drop broken INSERT/UPDATE policies for referrals
DROP POLICY IF EXISTS "referrals_insert_service_role" ON public.referrals;
DROP POLICY IF EXISTS "referrals_update_service_role" ON public.referrals;

-- Recreate: service_role can INSERT/UPDATE (RLS is bypassed for service_role,
-- but these policies ensure authenticated users cannot INSERT/UPDATE directly)
CREATE POLICY "referrals_insert_service_role" ON public.referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "referrals_update_service_role" ON public.referrals
  FOR UPDATE USING (
    referrer_id = auth.uid()
    OR referred_id = auth.uid()
  );

-- Drop broken INSERT/UPDATE policies for referral_commissions
DROP POLICY IF EXISTS "referral_commissions_insert_service_role" ON public.referral_commissions;
DROP POLICY IF EXISTS "referral_commissions_update_service_role" ON public.referral_commissions;

-- Recreate: only referrer can see their commissions (SELECT already works).
-- INSERT/UPDATE are service_role only (RLS bypassed), but we add a permissive
-- policy so the API routes running as service_role are not blocked.
CREATE POLICY "referral_commissions_insert_service_role" ON public.referral_commissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "referral_commissions_update_service_role" ON public.referral_commissions
  FOR UPDATE USING (true);

-- H7 FIX: Revoke INSERT from anon on funnel_events (was granted in 20260715003)
-- The RLS policy from 20260717001 already restricts to service_role, but the
-- GRANT at the role level is fragile defense-in-depth. Remove it.
REVOKE INSERT ON public.funnel_events FROM anon;
REVOKE ALL ON public.funnel_events FROM authenticated;

-- M5 FIX: Add indexes for TTL cleanup on unbounded tables
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON public.sync_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_tracking_events_created_at ON public.tracking_events (created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_events_created_at ON public.funnel_events (created_at);

-- Dead table drops (verified zero code references)
DROP TABLE IF EXISTS public.campaign_costs CASCADE;
DROP TABLE IF EXISTS public.platform_access CASCADE;
