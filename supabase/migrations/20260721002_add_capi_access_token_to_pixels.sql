-- CAPI token per-pixel: permite que cada produtor cadastre o Access Token da
-- API de Conversões específico do seu pixel (gerado em Business Manager >
-- Events Manager > Settings > Conversions API).
-- Antes o sistema usava um único token global (META_CAPI_ACCESS_TOKEN) que
-- só funcionava para pixels dentro do BM da Flowyn. Agora cada pixel tem seu
-- próprio token (encriptado em AES-256-GCM via encryptApiKey/decryptApiKey).

ALTER TABLE public.pixels
  ADD COLUMN IF NOT EXISTS capi_access_token TEXT;

COMMENT ON COLUMN public.pixels.capi_access_token IS 'Access Token da Conversions API da Meta (encriptado via AES-256-GCM). Opcional — se vazio, CAPI tenta usar access_token do ad_account do produtor. Aplicável apenas para platform=meta.';
