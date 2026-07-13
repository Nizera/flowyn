-- Track Meta API usage per user for rate limiting
CREATE TABLE IF NOT EXISTS public.meta_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  calls_made INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_api_usage_user_window ON public.meta_api_usage(user_id, window_start);

COMMENT ON TABLE public.meta_api_usage IS 'Track Meta API calls per user for rate limiting (200 calls/hour limit)';

ALTER TABLE public.meta_api_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_api_usage FROM anon, authenticated;
GRANT ALL ON public.meta_api_usage TO service_role;

-- Rate limiting is handled in application code (src/app/api/meta-ads/sync/route.ts)
-- and in the cron job (src/app/api/cron/meta-sync/route.ts)
-- Cleanup of old records is done by the cron job every run (>24h)
