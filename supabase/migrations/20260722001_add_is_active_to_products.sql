-- Adiciona is_active em products: controla se o produto está habilitado no plano free.
-- Quando o plano cai pra free, enforcePlanLimits() desabilita produtos excedentes.
-- O produtor pode reativar manualmente (dentro do limite do plano).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Todos os produtos existentes começam como ativos (conservador)
UPDATE public.products SET is_active = true WHERE is_active IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_owner_active ON public.products (owner_id, is_active);
