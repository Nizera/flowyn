-- Track utm parameters and server-side tracking events

-- 1. Add tracking_params to orders (replaces unused tracking_id)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_params JSONB;
ALTER TABLE public.orders DROP COLUMN IF EXISTS tracking_id;

COMMENT ON COLUMN public.orders.tracking_params IS 'UTM params and click IDs captured at checkout';

-- 2. Tracking events log (CAPI, postback, etc.)
CREATE TABLE IF NOT EXISTS public.tracking_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES public.products(id) ON DELETE SET NULL,
  producer_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL DEFAULT 'meta',
  event_name    TEXT NOT NULL DEFAULT 'Purchase',
  event_id      TEXT,
  status        TEXT NOT NULL DEFAULT 'sent',
  response      JSONB,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_order_id ON public.tracking_events(order_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_producer_id ON public.tracking_events(producer_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_created_at ON public.tracking_events(created_at);

COMMENT ON TABLE public.tracking_events IS 'Server-side tracking events sent to ad platforms (CAPI, etc.)';
COMMENT ON COLUMN public.tracking_events.event_id IS 'Used for deduplication with browser-side pixel';

-- RLS: only service_role can access (like other sensitive tables)
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tracking_events FROM anon, authenticated;
GRANT ALL ON public.tracking_events TO service_role;