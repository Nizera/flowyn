ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS net_value NUMERIC;
COMMENT ON COLUMN public.orders.net_value IS 'Net value from Asaas after payment fees';
