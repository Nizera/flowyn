-- Cron job to sync Meta Ads data every 30 minutes
-- Calls /api/cron/meta-sync which fetches campaigns, adsets, ads and insights from Meta Marketing API

-- Ensure pg_cron and http extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper function to read config (uses existing cron_config table)
-- Reuses: get_cron_config(config_key TEXT)

-- Function that makes the HTTP call for meta-sync
CREATE OR REPLACE FUNCTION meta_sync_http()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  base_url TEXT;
  secret   TEXT;
BEGIN
  base_url := get_cron_config('supabase_url');
  secret   := get_cron_config('reprocess_secret');

  IF base_url IS NULL OR secret IS NULL THEN
    RAISE WARNING 'meta-sync: missing config (supabase_url or reprocess_secret)';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url    := base_url || '/api/cron/meta-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || secret,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron')
  );
END;
$$;

-- Schedule the cron job (every 30 minutes)
SELECT cron.schedule(
  'meta-sync-ads',
  '*/30 * * * *',
  $$ SELECT meta_sync_http(); $$
);
