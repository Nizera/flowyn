-- Cost configurations: stores user-specific business settings (taxes, fees, production costs)

CREATE TABLE IF NOT EXISTS public.cost_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tax_percentage NUMERIC NOT NULL DEFAULT 0,  -- Impostos (%)
  asaas_flat_fee NUMERIC NOT NULL DEFAULT 0,  -- Taxa fixa Asaas (R$)
  asaas_percent_fee NUMERIC NOT NULL DEFAULT 0,  -- Taxa percentual Asaas (%)
  product_costs JSONB NOT NULL DEFAULT '[]'::JSONB,  -- Custos de produção [{name, cost}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

COMMENT ON TABLE public.cost_configurations IS 'Business cost configurations for net profit calculations';
COMMENT ON COLUMN public.cost_configurations.tax_percentage IS 'Tax percentage to deduct from revenue';
COMMENT ON COLUMN public.cost_configurations.asaas_flat_fee IS 'Fixed fee charged by Asaas per transaction';
COMMENT ON COLUMN public.cost_configurations.asaas_percent_fee IS 'Percentage fee charged by Asaas per transaction';
COMMENT ON COLUMN public.cost_configurations.product_costs IS 'JSONB array of product costs [{name, cost}]';

ALTER TABLE public.cost_configurations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cost_configurations FROM anon, authenticated;
GRANT ALL ON public.cost_configurations TO service_role;
