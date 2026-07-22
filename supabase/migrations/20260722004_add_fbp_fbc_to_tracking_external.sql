-- Migration 20260722004: Add _fbp/_fbc to tracking_external_events
-- GAP #7: _fbp/_fbc não eram capturados no tracking externo — impossível correlacionar
-- page views externos com pixel browser-side do Meta

ALTER TABLE public.tracking_external_events
  ADD COLUMN IF NOT EXISTS _fbp TEXT,
  ADD COLUMN IF NOT EXISTS _fbc TEXT;
