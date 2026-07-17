-- ============================================================
-- Migration: Programa de Indicação (Referrals)
-- 20% comissão sobre valor líquido, split automático Asaas
-- One-time referral (re-assinatura não gera comissão)
-- 30 dias janela de atribuição, sem limite de referrals
-- ============================================================

-- 1. Colunas na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);

-- Unique index on referral_code (permite NULL para quem não gerou código)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;

-- Index for fast lookup during checkout
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles (referred_by) WHERE referred_by IS NOT NULL;

-- 2. Tabela referrals: cada registro = 1 cliente indicado
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL,
  referrer_id UUID NOT NULL REFERENCES public.profiles(id),
  referred_id UUID NOT NULL REFERENCES public.profiles(id),
  first_payment_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (referral_code, referred_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals (referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals (referral_code);

-- 3. Tabela referral_commissions: cada pagamento gerou 1 comissão
CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES public.referrals(id),
  payment_id UUID NOT NULL REFERENCES public.orders(id),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'withdrawing', 'paid', 'split', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  UNIQUE (payment_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referral ON public.referral_commissions (referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_status ON public.referral_commissions (status);

-- 4. Coluna referred_by na tabela orders (para rastrear qual indicação gerou a venda)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS referral_id UUID REFERENCES public.referrals(id);
CREATE INDEX IF NOT EXISTS idx_orders_referral_id ON public.orders (referral_id) WHERE referral_id IS NOT NULL;

-- 5. Função para gerar código de indicação único
CREATE OR REPLACE FUNCTION public.generate_referral_code(profile_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code TEXT;
  exists_count INT;
BEGIN
  LOOP
    code := 'IND-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    SELECT COUNT(*) INTO exists_count FROM public.profiles WHERE referral_code = code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN code;
END;
$$;

-- 6. RLS policies

-- referrals: referrer e referred podem ver seus próprios registros; service_role vê tudo
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select_own" ON public.referrals
  FOR SELECT USING (
    referrer_id = auth.uid()
    OR referred_id = auth.uid()
  );

CREATE POLICY "referrals_insert_service_role" ON public.referrals
  FOR INSERT WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "referrals_update_service_role" ON public.referrals
  FOR UPDATE USING (current_setting('role') = 'service_role');

-- referral_commissions: referrer pode ver suas comissões; service_role vê tudo
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_commissions_select_own" ON public.referral_commissions
  FOR SELECT USING (
    referral_id IN (SELECT id FROM public.referrals WHERE referrer_id = auth.uid())
  );

CREATE POLICY "referral_commissions_insert_service_role" ON public.referral_commissions
  FOR INSERT WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "referral_commissions_update_service_role" ON public.referral_commissions
  FOR UPDATE USING (current_setting('role') = 'service_role');

-- 7. grants para service_role
GRANT ALL ON public.referrals TO service_role;
GRANT ALL ON public.referral_commissions TO service_role;

-- 8. Comentários
COMMENT ON TABLE public.referrals IS 'Registra cada cliente indicado por um produtor';
COMMENT ON TABLE public.referral_commissions IS 'Comissões geradas por pagamentos de clientes indicados (20% do valor líquido)';
COMMENT ON COLUMN public.profiles.referral_code IS 'Código único de indicação do produtor (ex: IND-A1B2C3D4)';
COMMENT ON COLUMN public.profiles.referred_by IS 'ID do produtor que indicou este cliente';
COMMENT ON COLUMN public.orders.referral_id IS 'ID do registro de indicação que gerou esta venda';
