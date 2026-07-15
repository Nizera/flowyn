ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_ip TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_agent TEXT;

COMMENT ON COLUMN public.orders.client_ip IS 'Real client IP captured at checkout for Meta CAPI matching';
COMMENT ON COLUMN public.orders.user_agent IS 'Real user agent captured at checkout for Meta CAPI matching';
