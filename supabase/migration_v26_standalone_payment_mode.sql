-- ============================================================
-- Migration v26: Standalone payment mode
-- Adiciona connection_mode para suportar contas standalone
-- (API key do produtor) além do modelo subconta existente.
-- ============================================================

ALTER TABLE public.payment_accounts
  ADD COLUMN IF NOT EXISTS connection_mode TEXT NOT NULL DEFAULT 'subaccount';

COMMENT ON COLUMN public.payment_accounts.connection_mode
  IS 'subaccount = split via conta principal Flowyn | standalone = API key do produtor, pagamento direto';
