-- Cron job to reprocess pending orders every 5 minutes
-- Calls /api/cron/reprocess-pending which checks Asaas and fulfills paid orders

-- Ensure pg_cron and http extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Config table to store secrets (avoids ALTER DATABASE which Supabase blocks)
CREATE TABLE IF NOT EXISTS cron_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Insert config (run these manually with your real values after creating the table):
-- INSERT INTO cron_config (key, value) VALUES ('supabase_url', 'https://nehoyrpmapzhecxhyvvd.supabase.co');
-- INSERT INTO cron_config (key, value) VALUES ('reprocess_secret', '123445677');

-- Helper function to read config
CREATE OR REPLACE FUNCTION get_cron_config(config_key TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT value FROM cron_config WHERE key = config_key;
$$;

-- Function that makes the HTTP call
CREATE OR REPLACE FUNCTION reprocess_pending_http()
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
    RAISE WARNING 'reprocess-pending: missing config (supabase_url or reprocess_secret)';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url    := base_url || '/api/cron/reprocess-pending',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || secret,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron')
  );
END;
$$;

-- Schedule the cron job
SELECT cron.schedule(
  'reprocess-pending-orders',
  '*/5 * * * *',
  $$ SELECT reprocess_pending_http(); $$
);
