-- Producer-only relaunch: keep legacy columns for compatibility, but disable the old public/partner flows.

UPDATE public.profiles
SET role = 'producer'::public.user_role
WHERE role = 'affiliate'::public.user_role;

UPDATE public.products
SET
  site_url = NULL,
  is_public = false,
  is_flowyn_saas = false,
  commission_rate = 0;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    'producer'::public.user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    role = CASE
      WHEN public.profiles.role = 'affiliate'::public.user_role THEN 'producer'::public.user_role
      ELSE public.profiles.role
    END,
    updated_at = now();

  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

DROP POLICY IF EXISTS "Public checkout can resolve active affiliations" ON public.affiliations;
DROP POLICY IF EXISTS "Affiliations viewable by owner and product owners" ON public.affiliations;
DROP POLICY IF EXISTS "Authenticated users can create own affiliations" ON public.affiliations;
DROP POLICY IF EXISTS "Affiliates can update own affiliation status" ON public.affiliations;
DROP POLICY IF EXISTS "Any authenticated user can create their own affiliations" ON public.affiliations;
DROP POLICY IF EXISTS "Affiliates can insert their own affiliations" ON public.affiliations;
DROP POLICY IF EXISTS "Affiliates can update their own affiliations status" ON public.affiliations;
DROP POLICY IF EXISTS "Disabled legacy affiliations" ON public.affiliations;

CREATE POLICY "Disabled legacy affiliations"
ON public.affiliations
FOR ALL TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Checkout can read active affiliation pixels" ON public.affiliation_pixels;
DROP POLICY IF EXISTS "Affiliate manages own affiliation pixels" ON public.affiliation_pixels;
DROP POLICY IF EXISTS "affiliate manages own affiliation pixels" ON public.affiliation_pixels;
DROP POLICY IF EXISTS "Disabled legacy affiliation pixels" ON public.affiliation_pixels;

CREATE POLICY "Disabled legacy affiliation pixels"
ON public.affiliation_pixels
FOR ALL TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Affiliates can view their commissioned orders" ON public.orders;
