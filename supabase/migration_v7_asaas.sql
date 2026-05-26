-- Migration v7: Asaas sandbox integration

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS asaas_account_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_api_key TEXT,
  ADD COLUMN IF NOT EXISTS asaas_account_status TEXT DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS asaas_company_type TEXT,
  ADD COLUMN IF NOT EXISTS asaas_birth_date DATE,
  ADD COLUMN IF NOT EXISTS asaas_income_value NUMERIC,
  ADD COLUMN IF NOT EXISTS asaas_address TEXT,
  ADD COLUMN IF NOT EXISTS asaas_address_number TEXT,
  ADD COLUMN IF NOT EXISTS asaas_complement TEXT,
  ADD COLUMN IF NOT EXISTS asaas_province TEXT,
  ADD COLUMN IF NOT EXISTS asaas_postal_code TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_status TEXT,
  ADD COLUMN IF NOT EXISTS customer_document TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_asaas_payment_id
  ON public.orders(asaas_payment_id);

CREATE INDEX IF NOT EXISTS idx_orders_asaas_customer_id
  ON public.orders(asaas_customer_id);

CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  payment_id TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only service role can manage Asaas webhook events" ON public.asaas_webhook_events;
CREATE POLICY "Only service role can manage Asaas webhook events"
ON public.asaas_webhook_events FOR ALL
USING (false)
WITH CHECK (false);
