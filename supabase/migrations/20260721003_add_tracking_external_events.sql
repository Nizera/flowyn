-- Tracking cross-domain (tracker.js colado na landing externa do produtor).
-- Como funnel_events exige plan_id (que o produtor não sabe na landing externa),
-- usamos product_id + pixel_id como chave. O tracker.js conhece pixel_id (snippet
-- configurado pelo produtor); o checkout da Flowyn conhece plan_id.
--
-- Guarda page_view / view_content externos para alimentar o funil de conversão.
-- Esses eventos são server-side first (bypass de ad blockers) com fallback client
-- (pixel do browser dispara via fbq e preenche cookies_first_party separadamente).

CREATE TABLE IF NOT EXISTS public.tracking_external_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  pixel_id        UUID REFERENCES public.pixels(id) ON DELETE CASCADE,  -- FK para pixels.id (não o pixel_id encriptado da Meta)
  product_id      UUID REFERENCES public.products(id) ON DELETE SET NULL,
  event_name      TEXT NOT NULL,                 -- 'page_view' ou 'view_content'
  url             TEXT NOT NULL,                -- full URL da página externa
  referrer        TEXT,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_content     TEXT,
  utm_term        TEXT,
  fbclid          TEXT,
  ttclid          TEXT,
  gclid           TEXT,
  client_ip       TEXT,
  user_agent      TEXT,
  session_id      TEXT NOT NULL,                 -- rand uuid gerado pelo tracker.js, persistido em cookie 1p
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adiciona pixel_public_token em pixels: uuid aleatório único que o produtor
-- coloca no snippet `<script src="https://flowyn.com/t/PUBLIC_TOKEN.js">`.
-- Não expõe o pixel_id real da Meta (que fica encriptado no DB).
ALTER TABLE public.pixels
  ADD COLUMN IF NOT EXISTS public_token UUID UNIQUE DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_pixels_public_token ON public.pixels(public_token);

CREATE INDEX IF NOT EXISTS idx_trkext_created_at    ON public.tracking_external_events (created_at);
CREATE INDEX IF NOT EXISTS idx_trkext_pixel_id      ON public.tracking_external_events (pixel_id);
CREATE INDEX IF NOT EXISTS idx_trkext_event_name    ON public.tracking_external_events (event_name);
CREATE INDEX IF NOT EXISTS idx_trkext_product_id    ON public.tracking_external_events (product_id);

ALTER TABLE public.tracking_external_events ENABLE ROW LEVEL SECURITY;

-- INSERT / SELECT só com service_role (tracker.js chama /api/tr/track que usa admin client)
DROP POLICY IF EXISTS "Service role insert external events" ON public.tracking_external_events;
CREATE POLICY "Service role insert external events"
  ON public.tracking_external_events
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Producers can view own external events" ON public.tracking_external_events;
CREATE POLICY "Producers can view own external events"
  ON public.tracking_external_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- TTL cleanup (180 dias — mesmo padrão de funnel_events)
CREATE INDEX IF NOT EXISTS idx_trkext_ttl_created_at ON public.tracking_external_events (created_at);
