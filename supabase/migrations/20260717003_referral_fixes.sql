-- ============================================================
-- Fix referral system: payment_id type, self-referral guard, trigger
-- ============================================================

-- 1. Fix payment_id: UUID REFERENCES orders(id) is wrong for platform-subscription commissions
--    Platform-subscription passes Asaas payment IDs (strings like 'pay_xxx')
--    Product-sale passes orders.id UUIDs
--    Solution: drop FK + change to TEXT so both sources work
ALTER TABLE public.referral_commissions DROP CONSTRAINT IF EXISTS referral_commissions_payment_id_fkey;
ALTER TABLE public.referral_commissions ALTER COLUMN payment_id TYPE TEXT;

-- Drop old unique constraint (was on UUID, now on TEXT)
ALTER TABLE public.referral_commissions DROP CONSTRAINT IF EXISTS referral_commissions_payment_id_key;
ALTER TABLE public.referral_commissions ADD CONSTRAINT referral_commissions_payment_id_key UNIQUE (payment_id);

-- 2. Self-referral guard: prevent referred_by = id at DB level
ALTER TABLE public.profiles ADD CONSTRAINT profiles_no_self_referral CHECK (referred_by IS NULL OR referred_by <> id);

-- 3. One referrer per referred user (prevent race in layout resolution)
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_referrer_referred_key;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_referred_id_unique UNIQUE (referred_id);

-- 4. Self-referral guard on referrals table
ALTER TABLE public.referrals ADD CONSTRAINT referrals_no_self_referral CHECK (referrer_id <> referred_id);

-- 5. Protect referred_by and referral_code from client-side mutation
--    Add them to the existing trigger function
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
    or new.referred_by is distinct from old.referred_by
    or new.referral_code is distinct from old.referral_code
  then
    raise exception 'Sensitive profile fields can only be updated by the service role';
  end if;

  return new;
end;
$$;
