-- ============================================================
-- FIX #32: Restrict funnel_events INSERT to service_role only
-- Prevents anonymous spam of funnel analytics data
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert funnel events" ON public.funnel_events;
CREATE POLICY "Service role can insert funnel events"
  ON public.funnel_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- FIX #33: Restrict automation_rules_log INSERT to service_role only
-- Prevents any authenticated user from injecting fake audit logs
-- ============================================================

DROP POLICY IF EXISTS "System can insert automation logs" ON public.automation_rules_log;
CREATE POLICY "Service role can insert automation logs"
  ON public.automation_rules_log FOR INSERT
  TO service_role
  WITH CHECK (true);
