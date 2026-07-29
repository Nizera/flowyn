-- Fix referral_commissions RLS: restrict INSERT/UPDATE to service_role only
-- Previous migration used WITH CHECK (true) which allowed any authenticated user

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "referral_commissions_insert_service_role" ON public.referral_commissions;
DROP POLICY IF EXISTS "referral_commissions_update_service_role" ON public.referral_commissions;

-- Recreate with proper restrictions: only service_role can INSERT/UPDATE
CREATE POLICY "referral_commissions_insert_service_role" ON public.referral_commissions
  FOR INSERT WITH CHECK (false);

CREATE POLICY "referral_commissions_update_service_role" ON public.referral_commissions
  FOR UPDATE USING (false);

-- Verify SELECT policy still restricts to referrer only (should already exist)
-- If not, create it:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'referral_commissions'
    AND policyname = 'referral_commissions_select_referrer'
  ) THEN
    CREATE POLICY "referral_commissions_select_referrer" ON public.referral_commissions
      FOR SELECT USING (
        referral_id IN (
          SELECT id FROM public.referrals WHERE referrer_id = auth.uid()
        )
      );
  END IF;
END $$;
