-- ============================================================
-- FIX #1: Protect plan column from self-upgrade
-- ============================================================

-- Add CHECK constraint for allowed plan values
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'pro', 'scale'));

-- Update trigger to also protect the plan column
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
declare
  jwt_role text := coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '');
begin
  if jwt_role = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if new.role is distinct from old.role
    or new.asaas_api_key is distinct from old.asaas_api_key
    or new.asaas_account_id is distinct from old.asaas_account_id
    or new.asaas_wallet_id is distinct from old.asaas_wallet_id
    or new.asaas_account_status is distinct from old.asaas_account_status
    or new.asaas_onboarding_status is distinct from old.asaas_onboarding_status
    or new.plan is distinct from old.plan
  then
    raise exception 'Sensitive profile fields can only be updated by the service role';
  end if;

  return new;
end;
$$;

-- ============================================================
-- FIX #5: Grant authenticated role on meta_api_usage
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_api_usage TO authenticated;

ALTER TABLE public.meta_api_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own api usage" ON public.meta_api_usage;
CREATE POLICY "Users manage own api usage"
  ON public.meta_api_usage
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================
-- FIX #6: Grant authenticated role on ad_insights_cache
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_insights_cache TO authenticated;

ALTER TABLE public.ad_insights_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own ad insights" ON public.ad_insights_cache;
CREATE POLICY "Users read own ad insights"
  ON public.ad_insights_cache
  FOR SELECT
  TO authenticated
  USING (
    ad_account_id IN (
      SELECT ad_account_id FROM public.ad_accounts
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users upsert own ad insights" ON public.ad_insights_cache;
CREATE POLICY "Users upsert own ad insights"
  ON public.ad_insights_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ad_account_id IN (
      SELECT ad_account_id FROM public.ad_accounts
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users update own ad insights" ON public.ad_insights_cache;
CREATE POLICY "Users update own ad insights"
  ON public.ad_insights_cache
  FOR UPDATE
  TO authenticated
  USING (
    ad_account_id IN (
      SELECT ad_account_id FROM public.ad_accounts
      WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    ad_account_id IN (
      SELECT ad_account_id FROM public.ad_accounts
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- FIX #3: Function to revoke expired grace periods
-- ============================================================

CREATE OR REPLACE FUNCTION public.revoke_expired_grace_periods()
RETURNS void
LANGUAGE plpgsql
AS $$
begin
  -- Downgrade platform_subscriptions that are past grace period
  UPDATE public.platform_subscriptions
  SET status = 'suspended',
      updated_at = now()
  WHERE status = 'grace_period'
    AND grace_period_ends_at IS NOT NULL
    AND grace_period_ends_at < now();

  -- Also downgrade profiles.plan for suspended subscriptions
  UPDATE public.profiles
  SET plan = 'free',
      updated_at = now()
  WHERE id IN (
    SELECT user_id FROM public.platform_subscriptions
    WHERE status = 'suspended'
      AND plan != 'free'
  );
end;
$$;
