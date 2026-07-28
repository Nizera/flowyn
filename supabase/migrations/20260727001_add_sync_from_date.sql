-- Add sync_from_date to ad_accounts
-- This field stores the date from which insights should be synced
-- When a user first enables sync for an account, we set this to the current date
-- This ensures we only fetch data from the connection date forward, not historical data

ALTER TABLE ad_accounts ADD COLUMN IF NOT EXISTS sync_from_date DATE;

-- Set sync_from_date to today for all existing accounts that have sync enabled
-- This prevents fetching old historical data for accounts that were already connected
UPDATE ad_accounts 
SET sync_from_date = CURRENT_DATE 
WHERE sync_from_date IS NULL AND sync_enabled = true;
