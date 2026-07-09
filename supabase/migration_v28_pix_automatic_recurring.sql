-- Migration v28: Pix Automático + Assinaturas recorrentes
-- Suporte a cobranças recorrentes via Pix Automático e cartão de crédito

-- Nova tabela para autorizações Pix Automático
CREATE TABLE IF NOT EXISTS public.pix_automatic_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  buyer_email TEXT,
  buyer_name TEXT,
  status TEXT NOT NULL DEFAULT 'CREATED',
  frequency TEXT NOT NULL DEFAULT 'MONTHLY',
  value NUMERIC NOT NULL,
  start_date DATE NOT NULL,
  finish_date DATE,
  asaas_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pix_auth_status ON public.pix_automatic_authorizations(status);
CREATE INDEX IF NOT EXISTS idx_pix_auth_order ON public.pix_automatic_authorizations(order_id);
CREATE INDEX IF NOT EXISTS idx_pix_auth_product ON public.pix_automatic_authorizations(product_id);
CREATE INDEX IF NOT EXISTS idx_pix_auth_email ON public.pix_automatic_authorizations(buyer_email);
CREATE INDEX IF NOT EXISTS idx_pix_auth_next_charge ON public.pix_automatic_authorizations(status, frequency, start_date)
  WHERE status = 'ACTIVE';

-- Coluna na tabela orders para referenciar autorização Pix Automático
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pix_authorization_id TEXT;

-- Colunas para controle de cobrança recorrente em orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS recurring_charge_number INTEGER DEFAULT 0;

-- RLS: Apenas service_role acessa pix_automatic_authorizations
ALTER TABLE public.pix_automatic_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can manage pix automatic authorizations"
ON public.pix_automatic_authorizations
FOR ALL
USING (false)
WITH CHECK (false);

-- Garantir que REVOKE está aplicado
REVOKE ALL ON public.pix_automatic_authorizations FROM authenticated;
REVOKE ALL ON public.pix_automatic_authorizations FROM anon;
GRANT SELECT ON public.pix_automatic_authorizations TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.pix_automatic_authorizations TO service_role;
