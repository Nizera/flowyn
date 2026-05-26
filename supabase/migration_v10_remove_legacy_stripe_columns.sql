-- Migration v10: remove legacy Stripe columns after Asaas migration

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT := COALESCE((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '');
BEGIN
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.asaas_api_key IS DISTINCT FROM OLD.asaas_api_key
    OR NEW.asaas_account_id IS DISTINCT FROM OLD.asaas_account_id
    OR NEW.asaas_wallet_id IS DISTINCT FROM OLD.asaas_wallet_id
    OR NEW.asaas_account_status IS DISTINCT FROM OLD.asaas_account_status
    OR NEW.asaas_onboarding_status IS DISTINCT FROM OLD.asaas_onboarding_status
  THEN
    RAISE EXCEPTION 'Sensitive profile fields can only be updated by the service role';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_sensitive_fields() FROM anon, authenticated, public;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS stripe_account_id,
  DROP COLUMN IF EXISTS stripe_account_status,
  DROP COLUMN IF EXISTS stripe_onboarding_complete;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS stripe_product_id;

ALTER TABLE public.plans
  DROP COLUMN IF EXISTS stripe_price_id;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS stripe_payment_id,
  DROP COLUMN IF EXISTS stripe_payment_intent_id,
  DROP COLUMN IF EXISTS stripe_session_id;

ALTER TABLE public.flowyn_saas_products
  DROP COLUMN IF EXISTS stripe_product_id,
  DROP COLUMN IF EXISTS stripe_price_id;

DROP INDEX IF EXISTS public.idx_orders_stripe_payment_intent_id;
