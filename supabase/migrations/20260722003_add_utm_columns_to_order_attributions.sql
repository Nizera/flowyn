-- Migration 20260722003: Add UTM + click ID columns to order_attributions
-- GAP #3: A migration original (20260709009) não definia utm_source, utm_medium, utm_content,
-- utm_term, click_id_type, click_id_value — o código tentava inserir essas colunas e falhava silenciosamente

ALTER TABLE public.order_attributions
  ADD COLUMN IF NOT EXISTS utm_source      TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium      TEXT,
  ADD COLUMN IF NOT EXISTS utm_content     TEXT,
  ADD COLUMN IF NOT EXISTS utm_term        TEXT,
  ADD COLUMN IF NOT EXISTS click_id_type   TEXT,
  ADD COLUMN IF NOT EXISTS click_id_value  TEXT;

CREATE INDEX IF NOT EXISTS idx_attr_utm_source ON public.order_attributions(utm_source);
CREATE INDEX IF NOT EXISTS idx_attr_utm_medium ON public.order_attributions(utm_medium);
