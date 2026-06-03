-- Checkout editor: draft and published visual configuration per product.

CREATE TABLE IF NOT EXISTS public.checkout_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  draft_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.checkout_customizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Product owners can view checkout customizations" ON public.checkout_customizations;
CREATE POLICY "Product owners can view checkout customizations"
ON public.checkout_customizations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = checkout_customizations.product_id
      AND p.owner_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Product owners can insert checkout customizations" ON public.checkout_customizations;
CREATE POLICY "Product owners can insert checkout customizations"
ON public.checkout_customizations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = checkout_customizations.product_id
      AND p.owner_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Product owners can update checkout customizations" ON public.checkout_customizations;
CREATE POLICY "Product owners can update checkout customizations"
ON public.checkout_customizations FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = checkout_customizations.product_id
      AND p.owner_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = checkout_customizations.product_id
      AND p.owner_id = (SELECT auth.uid())
  )
);

GRANT SELECT, INSERT, UPDATE ON public.checkout_customizations TO authenticated;
GRANT ALL ON public.checkout_customizations TO service_role;
