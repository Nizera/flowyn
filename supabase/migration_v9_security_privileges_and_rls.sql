-- Migration v9: least-privilege grants, RLS performance cleanup, and private product secrets

CREATE TABLE IF NOT EXISTS public.product_private_settings (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  webhook_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.product_private_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only service role can manage product private settings" ON public.product_private_settings;
CREATE POLICY "Only service role can manage product private settings"
ON public.product_private_settings FOR ALL
USING (false)
WITH CHECK (false);

INSERT INTO public.product_private_settings (product_id, webhook_secret)
SELECT id, webhook_secret
FROM public.products
WHERE webhook_secret IS NOT NULL
ON CONFLICT (product_id) DO UPDATE SET
  webhook_secret = EXCLUDED.webhook_secret,
  updated_at = NOW();

UPDATE public.products
SET webhook_secret = NULL
WHERE webhook_secret IS NOT NULL;

REVOKE ALL ON public.product_private_settings FROM anon, authenticated;
GRANT ALL ON public.product_private_settings TO service_role;

-- Remove broad default API privileges and add only the verbs the app needs.
REVOKE ALL ON
  public.affiliation_pixels,
  public.affiliations,
  public.asaas_webhook_events,
  public.course_lessons,
  public.course_modules,
  public.flowyn_saas_products,
  public.orders,
  public.payment_accounts,
  public.pixels,
  public.plan_pixels,
  public.plans,
  public.platform_settings,
  public.products,
  public.student_access,
  public.webhook_logs
FROM anon, authenticated;

GRANT SELECT ON public.products, public.plans, public.course_modules, public.course_lessons, public.flowyn_saas_products TO anon;
GRANT SELECT ON public.affiliations, public.plan_pixels, public.affiliation_pixels, public.pixels TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.products,
  public.plans,
  public.affiliations,
  public.pixels,
  public.plan_pixels,
  public.affiliation_pixels,
  public.course_modules,
  public.course_lessons
TO authenticated;

GRANT SELECT ON public.orders, public.student_access, public.webhook_logs, public.flowyn_saas_products TO authenticated;
GRANT ALL ON
  public.affiliation_pixels,
  public.affiliations,
  public.asaas_webhook_events,
  public.course_lessons,
  public.course_modules,
  public.flowyn_saas_products,
  public.orders,
  public.payment_accounts,
  public.pixels,
  public.plan_pixels,
  public.plans,
  public.platform_settings,
  public.products,
  public.student_access,
  public.webhook_logs
TO service_role;

-- Public checkout/market reads should only see public products.
DROP POLICY IF EXISTS "Products are viewable by everyone." ON public.products;
DROP POLICY IF EXISTS "Any authenticated user can insert their own products." ON public.products;
DROP POLICY IF EXISTS "Producers can update their own products." ON public.products;
DROP POLICY IF EXISTS "Producers can delete their own products." ON public.products;

CREATE POLICY "Public products are viewable"
ON public.products FOR SELECT TO anon, authenticated
USING (is_public = true OR owner_id = (select auth.uid()));

CREATE POLICY "Users can insert their own products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY "Product owners can update their own products"
ON public.products FOR UPDATE TO authenticated
USING (owner_id = (select auth.uid()))
WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY "Product owners can delete their own products"
ON public.products FOR DELETE TO authenticated
USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Plans are viewable by everyone." ON public.plans;
DROP POLICY IF EXISTS "Producers can manage plans for their products." ON public.plans;

CREATE POLICY "Plans for public or owned products are viewable"
ON public.plans FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = plans.product_id
      AND (p.is_public = true OR p.owner_id = (select auth.uid()))
  )
);

CREATE POLICY "Product owners can insert plans"
ON public.plans FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = plans.product_id
      AND p.owner_id = (select auth.uid())
  )
);

CREATE POLICY "Product owners can update plans"
ON public.plans FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = plans.product_id
      AND p.owner_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = plans.product_id
      AND p.owner_id = (select auth.uid())
  )
);

CREATE POLICY "Product owners can delete plans"
ON public.plans FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = plans.product_id
      AND p.owner_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Affiliations viewable by owner and product owners" ON public.affiliations;
DROP POLICY IF EXISTS "Any authenticated user can create their own affiliations" ON public.affiliations;
DROP POLICY IF EXISTS "Affiliates can update their own affiliations status" ON public.affiliations;

CREATE POLICY "Public checkout can resolve active affiliations"
ON public.affiliations FOR SELECT TO anon
USING (status = 'active');

CREATE POLICY "Affiliations viewable by participant and product owners"
ON public.affiliations FOR SELECT TO authenticated
USING (
  affiliate_id = (select auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = affiliations.product_id
      AND p.owner_id = (select auth.uid())
  )
);

CREATE POLICY "Authenticated users can create own affiliations"
ON public.affiliations FOR INSERT TO authenticated
WITH CHECK (affiliate_id = (select auth.uid()));

CREATE POLICY "Affiliates can update own affiliation status"
ON public.affiliations FOR UPDATE TO authenticated
USING (affiliate_id = (select auth.uid()))
WITH CHECK (affiliate_id = (select auth.uid()));

DROP POLICY IF EXISTS "users manage own pixels" ON public.pixels;
CREATE POLICY "Checkout can read active pixels"
ON public.pixels FOR SELECT TO anon
USING (is_active = true);

CREATE POLICY "Users can manage own pixels"
ON public.pixels FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "producer manages plan pixels" ON public.plan_pixels;
CREATE POLICY "Checkout can read public plan pixels"
ON public.plan_pixels FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.plans pl
    JOIN public.products p ON p.id = pl.product_id
    WHERE pl.id = plan_pixels.plan_id
      AND p.is_public = true
  )
);

CREATE POLICY "Producer manages plan pixels"
ON public.plan_pixels FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.plans pl
    JOIN public.products p ON p.id = pl.product_id
    WHERE pl.id = plan_pixels.plan_id
      AND p.owner_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.plans pl
    JOIN public.products p ON p.id = pl.product_id
    WHERE pl.id = plan_pixels.plan_id
      AND p.owner_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "affiliate manages own affiliation pixels" ON public.affiliation_pixels;
CREATE POLICY "Checkout can read active affiliation pixels"
ON public.affiliation_pixels FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.affiliations a
    WHERE a.id = affiliation_pixels.affiliation_id
      AND a.status = 'active'
  )
);

CREATE POLICY "Affiliate manages own affiliation pixels"
ON public.affiliation_pixels FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.affiliations a
    WHERE a.id = affiliation_pixels.affiliation_id
      AND a.affiliate_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.affiliations a
    WHERE a.id = affiliation_pixels.affiliation_id
      AND a.affiliate_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Course modules viewable by everyone" ON public.course_modules;
DROP POLICY IF EXISTS "Product owners can manage modules" ON public.course_modules;

CREATE POLICY "Public product modules are viewable"
ON public.course_modules FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = course_modules.product_id
      AND (p.is_public = true OR p.owner_id = (select auth.uid()))
  )
);

CREATE POLICY "Product owners can insert modules"
ON public.course_modules FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = course_modules.product_id
      AND p.owner_id = (select auth.uid())
  )
);

CREATE POLICY "Product owners can update modules"
ON public.course_modules FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = course_modules.product_id
      AND p.owner_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = course_modules.product_id
      AND p.owner_id = (select auth.uid())
  )
);

CREATE POLICY "Product owners can delete modules"
ON public.course_modules FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = course_modules.product_id
      AND p.owner_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Free preview lessons viewable by everyone" ON public.course_lessons;
DROP POLICY IF EXISTS "Product owners can manage lessons" ON public.course_lessons;

CREATE POLICY "Free public preview lessons are viewable"
ON public.course_lessons FOR SELECT TO anon, authenticated
USING (
  is_free_preview = true
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = course_lessons.product_id
      AND (p.is_public = true OR p.owner_id = (select auth.uid()))
  )
);

CREATE POLICY "Product owners can insert lessons"
ON public.course_lessons FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = course_lessons.product_id
      AND p.owner_id = (select auth.uid())
  )
);

CREATE POLICY "Product owners can update lessons"
ON public.course_lessons FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = course_lessons.product_id
      AND p.owner_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = course_lessons.product_id
      AND p.owner_id = (select auth.uid())
  )
);

CREATE POLICY "Product owners can delete lessons"
ON public.course_lessons FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = course_lessons.product_id
      AND p.owner_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Flowyn SaaS products viewable by everyone" ON public.flowyn_saas_products;
DROP POLICY IF EXISTS "Only service role can manage Flowyn SaaS" ON public.flowyn_saas_products;

CREATE POLICY "Flowyn SaaS products viewable by everyone"
ON public.flowyn_saas_products FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "No client inserts Flowyn SaaS products"
ON public.flowyn_saas_products FOR INSERT TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "No client updates Flowyn SaaS products"
ON public.flowyn_saas_products FOR UPDATE TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "No client deletes Flowyn SaaS products"
ON public.flowyn_saas_products FOR DELETE TO anon, authenticated
USING (false);

DROP POLICY IF EXISTS "Affiliates can view their commissioned orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Producers can view orders for their products" ON public.orders;

CREATE POLICY "Users can view relevant orders"
ON public.orders FOR SELECT TO authenticated
USING (
  affiliate_id = (select auth.uid())
  OR customer_user_id = (select auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = orders.product_id
      AND p.owner_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can view their own access" ON public.student_access;
DROP POLICY IF EXISTS "Product owners can view access list" ON public.student_access;

CREATE POLICY "Users can view relevant student access"
ON public.student_access FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = student_access.product_id
      AND p.owner_id = (select auth.uid())
  )
);

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
