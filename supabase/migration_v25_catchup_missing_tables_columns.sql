-- ============================================================================
-- Migration v25: Catch-up — tabelas e colunas ausentes nas migrations anteriores
-- Cria tabelas que existiam no banco mas não tinham CREATE TABLE rastreado,
-- e adiciona colunas que o código já consultava mas não tinham ADD COLUMN.
-- ============================================================================

-- ============================================================
-- 1. TABELA: pixels (tracking de pixels de publicidade)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pixels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  pixel_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pixels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pixels are viewable by everyone when active" ON public.pixels;
CREATE POLICY "Pixels are viewable by everyone when active"
  ON public.pixels FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Producers can manage own pixels" ON public.pixels;
CREATE POLICY "Producers can manage own pixels"
  ON public.pixels FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_pixels_user_id ON public.pixels(user_id);

-- ============================================================
-- 2. TABELA: plan_pixels (associação plan <-> pixel)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plan_pixels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  pixel_id UUID NOT NULL REFERENCES public.pixels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, pixel_id)
);

ALTER TABLE public.plan_pixels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plan pixels viewable for public plans" ON public.plan_pixels;
CREATE POLICY "Plan pixels viewable for public plans"
  ON public.plan_pixels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      JOIN public.products pr ON pr.id = p.product_id
      WHERE p.id = plan_pixels.plan_id AND pr.is_public = true
    )
  );

DROP POLICY IF EXISTS "Producers can manage plan pixels for own products" ON public.plan_pixels;
CREATE POLICY "Producers can manage plan pixels for own products"
  ON public.plan_pixels FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      JOIN public.products pr ON pr.id = p.product_id
      WHERE p.id = plan_pixels.plan_id AND pr.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_plan_pixels_plan_id ON public.plan_pixels(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_pixels_pixel_id ON public.plan_pixels(pixel_id);

-- ============================================================
-- 3. TABELA: affiliation_pixels (desativada — legado de afiliados)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.affiliation_pixels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliation_id UUID NOT NULL REFERENCES public.affiliations(id) ON DELETE CASCADE,
  pixel_id UUID NOT NULL REFERENCES public.pixels(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.affiliation_pixels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliation pixels disabled (legacy)" ON public.affiliation_pixels;
CREATE POLICY "Affiliation pixels disabled (legacy)"
  ON public.affiliation_pixels FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_affiliation_pixels_pixel_id ON public.affiliation_pixels(pixel_id);
CREATE INDEX IF NOT EXISTS idx_affiliation_pixels_plan_id ON public.affiliation_pixels(plan_id);

-- ============================================================
-- 4. COLUNAS ausentes na tabela products
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkout_mode TEXT DEFAULT 'direct';

-- ============================================================
-- 5. COLUNAS ausentes na tabela plans
-- ============================================================
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS plan_identifier TEXT,
  ADD COLUMN IF NOT EXISTS interval TEXT,
  ADD COLUMN IF NOT EXISTS interval_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS asaas_plan_id TEXT;
