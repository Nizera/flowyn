-- Migration v8: security hardening after Asaas migration

-- 1. Private payment account secrets. Service role bypasses RLS; clients do not read this table.
CREATE TABLE IF NOT EXISTS public.payment_accounts (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'asaas',
  provider_account_id TEXT,
  wallet_id TEXT,
  api_key TEXT,
  status TEXT DEFAULT 'connected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only service role can manage payment accounts" ON public.payment_accounts;
CREATE POLICY "Only service role can manage payment accounts"
ON public.payment_accounts FOR ALL
USING (false)
WITH CHECK (false);

INSERT INTO public.payment_accounts (
  user_id,
  provider,
  provider_account_id,
  wallet_id,
  api_key,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  'asaas',
  asaas_account_id,
  asaas_wallet_id,
  asaas_api_key,
  COALESCE(asaas_account_status, asaas_onboarding_status, 'connected'),
  NOW(),
  NOW()
FROM public.profiles
WHERE asaas_api_key IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  provider_account_id = EXCLUDED.provider_account_id,
  wallet_id = EXCLUDED.wallet_id,
  api_key = EXCLUDED.api_key,
  status = EXCLUDED.status,
  updated_at = NOW();

UPDATE public.profiles
SET asaas_api_key = NULL
WHERE asaas_api_key IS NOT NULL;

-- 2. Profiles: public can only read display names; signed-in users can read/update their own row.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name) ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

CREATE POLICY "Public profile names are viewable"
ON public.profiles FOR SELECT TO anon
USING (true);

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own non-sensitive profile"
ON public.profiles FOR UPDATE TO authenticated
USING ((select auth.uid()) = id)
WITH CHECK ((select auth.uid()) = id);

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
    OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
    OR NEW.stripe_account_status IS DISTINCT FROM OLD.stripe_account_status
    OR NEW.stripe_onboarding_complete IS DISTINCT FROM OLD.stripe_onboarding_complete
  THEN
    RAISE EXCEPTION 'Sensitive profile fields can only be updated by the service role';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    new.id,
    'affiliate'::user_role,
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_sensitive_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_fields_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- 3. Orders: only service role writes; users read rows they own/participate in.
DROP POLICY IF EXISTS "Anyone can create orders via checkout" ON public.orders;
DROP POLICY IF EXISTS "System can update orders" ON public.orders;
DROP POLICY IF EXISTS "System can read orders for webhooks" ON public.orders;
DROP POLICY IF EXISTS "Affiliates can view their commissioned orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Producers can view orders for their products" ON public.orders;
DROP POLICY IF EXISTS "Anyone can read order site_url for activation" ON public.orders;

CREATE POLICY "Affiliates can view their commissioned orders"
ON public.orders FOR SELECT TO authenticated
USING ((select auth.uid()) = affiliate_id);

CREATE POLICY "Customers can view their own orders"
ON public.orders FOR SELECT TO authenticated
USING ((select auth.uid()) = customer_user_id);

CREATE POLICY "Producers can view orders for their products"
ON public.orders FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = orders.product_id
      AND p.owner_id = (select auth.uid())
  )
);

-- 4. Student access: service role writes; users and product owners read.
DROP POLICY IF EXISTS "System can manage student access" ON public.student_access;
DROP POLICY IF EXISTS "Users can view their own access" ON public.student_access;
DROP POLICY IF EXISTS "Product owners can view access list" ON public.student_access;

CREATE POLICY "Users can view their own access"
ON public.student_access FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "Product owners can view access list"
ON public.student_access FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = student_access.product_id
      AND p.owner_id = (select auth.uid())
  )
);

-- 5. Webhook logs: service role inserts; producers read.
DROP POLICY IF EXISTS "System can insert webhook logs" ON public.webhook_logs;
DROP POLICY IF EXISTS "Producers can view webhook logs for their products" ON public.webhook_logs;

CREATE POLICY "Producers can view webhook logs for their products"
ON public.webhook_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = webhook_logs.product_id
      AND p.owner_id = (select auth.uid())
  )
);

-- 6. Platform settings are not client-readable.
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only service role can manage platform settings" ON public.platform_settings;
CREATE POLICY "Only service role can manage platform settings"
ON public.platform_settings FOR ALL
USING (false)
WITH CHECK (false);

-- 7. Lock down SECURITY DEFINER helper.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_profile_sensitive_fields() FROM anon, authenticated, public;

-- 8. Storage: keep public image URLs working, but stop public listing and require user folder for uploads.
DROP POLICY IF EXISTS "product_images_select" ON storage.objects;
DROP POLICY IF EXISTS "product_images_insert" ON storage.objects;

CREATE POLICY "product_images_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (select auth.uid())::text = (storage.foldername(name))[1]
);

-- 9. Cover unindexed foreign keys reported by advisors.
CREATE INDEX IF NOT EXISTS idx_affiliation_pixels_pixel_id ON public.affiliation_pixels(pixel_id);
CREATE INDEX IF NOT EXISTS idx_affiliation_pixels_plan_id ON public.affiliation_pixels(plan_id);
CREATE INDEX IF NOT EXISTS idx_affiliations_product_id ON public.affiliations(product_id);
CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_order_id ON public.asaas_webhook_events(order_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_module_id ON public.course_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_product_id ON public.course_lessons(product_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_product_id ON public.course_modules(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_affiliate_id ON public.orders(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_user_id ON public.orders(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_plan_id ON public.orders(plan_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON public.orders(product_id);
CREATE INDEX IF NOT EXISTS idx_pixels_user_id ON public.pixels(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_pixels_pixel_id ON public.plan_pixels(pixel_id);
CREATE INDEX IF NOT EXISTS idx_plans_product_id ON public.plans(product_id);
CREATE INDEX IF NOT EXISTS idx_products_owner_id ON public.products(owner_id);
CREATE INDEX IF NOT EXISTS idx_student_access_order_id ON public.student_access(order_id);
CREATE INDEX IF NOT EXISTS idx_student_access_product_id ON public.student_access(product_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_order_id ON public.webhook_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_product_id ON public.webhook_logs(product_id);
