-- Upsell pós-compra: campos de configuração na tabela products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS upsell_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upsell_url text,
  ADD COLUMN IF NOT EXISTS upsell_button_text text,
  ADD COLUMN IF NOT EXISTS upsell_headline text;
