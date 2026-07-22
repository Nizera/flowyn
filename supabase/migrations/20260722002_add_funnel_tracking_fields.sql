-- Migration 20260722002: Add session_id + click IDs to funnel_events
-- GAP #1/#2: funnel_events não tinha session_id → deduplicação entre landing externa e checkout estava quebrada
-- GAP #5: click IDs (fbclid, gclid, ttclid) e custom params (src, sck) não eram salvos

ALTER TABLE public.funnel_events
  ADD COLUMN IF NOT EXISTS session_id   UUID,
  ADD COLUMN IF NOT EXISTS fbclid      TEXT,
  ADD COLUMN IF NOT EXISTS gclid       TEXT,
  ADD COLUMN IF NOT EXISTS ttclid      TEXT,
  ADD COLUMN IF NOT EXISTS src         TEXT,
  ADD COLUMN IF NOT EXISTS sck         TEXT,
  ADD COLUMN IF NOT EXISTS _fbp        TEXT,
  ADD COLUMN IF NOT EXISTS _fbc        TEXT;

CREATE INDEX IF NOT EXISTS idx_funnel_events_session_id ON public.funnel_events(session_id);
