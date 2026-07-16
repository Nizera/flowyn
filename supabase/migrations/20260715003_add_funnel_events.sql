-- Migration 20260715003: Add funnel_events table for Utmify-style conversion funnel
CREATE TABLE IF NOT EXISTS public.funnel_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID REFERENCES public.products(id) ON DELETE CASCADE,
  plan_id       UUID REFERENCES public.plans(id) ON DELETE CASCADE,
  event_name    TEXT NOT NULL, -- 'page_view', 'initiate_checkout'
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_content   TEXT,
  utm_term      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_funnel_events_product_id ON public.funnel_events(product_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_plan_id ON public.funnel_events(plan_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_event_name ON public.funnel_events(event_name);
CREATE INDEX IF NOT EXISTS idx_funnel_events_created_at ON public.funnel_events(created_at);

-- Enable RLS and setup permissions
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

-- Allow public anonymous/authenticated insertions for tracking events
CREATE POLICY "Anyone can insert funnel events" ON public.funnel_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Allow producers to view funnel events for their products
CREATE POLICY "Producers can view funnel events for their products" ON public.funnel_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = funnel_events.product_id AND p.owner_id = auth.uid())
  );

GRANT ALL ON public.funnel_events TO anon, authenticated, service_role;
