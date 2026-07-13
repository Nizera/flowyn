-- Add sync_enabled column to ad_accounts
ALTER TABLE public.ad_accounts ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.ad_accounts.sync_enabled IS 'Whether this account should be synced by the cron job';
