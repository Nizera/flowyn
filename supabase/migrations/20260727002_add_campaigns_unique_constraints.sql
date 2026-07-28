-- Add unique constraints to prevent duplicate records across sync operations
-- These constraints MUST match the onConflict columns in meta-sync.ts upserts

-- ============================================================
-- 1. Campaigns
-- ============================================================
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, ad_account_id, campaign_id
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  ) AS rn
  FROM campaigns
)
DELETE FROM campaigns WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_user_account_campaign_unique'
  ) THEN
    ALTER TABLE campaigns ADD CONSTRAINT campaigns_user_account_campaign_unique
      UNIQUE (user_id, ad_account_id, campaign_id);
  END IF;
END $$;

-- ============================================================
-- 2. Ad Sets
-- ============================================================
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, ad_account_id, ad_set_id
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  ) AS rn
  FROM ad_sets
)
DELETE FROM ad_sets WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ad_sets_user_account_adset_unique'
  ) THEN
    ALTER TABLE ad_sets ADD CONSTRAINT ad_sets_user_account_adset_unique
      UNIQUE (user_id, ad_account_id, ad_set_id);
  END IF;
END $$;

-- ============================================================
-- 3. Ads
-- ============================================================
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, ad_account_id, ad_id
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  ) AS rn
  FROM ads
)
DELETE FROM ads WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ads_user_account_ad_unique'
  ) THEN
    ALTER TABLE ads ADD CONSTRAINT ads_user_account_ad_unique
      UNIQUE (user_id, ad_account_id, ad_id);
  END IF;
END $$;

-- ============================================================
-- 4. Ad Insights Cache (used by ad_insights_cache upsert)
-- ============================================================
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY ad_account_id, campaign_id, ad_set_id, ad_id, insight_level, date
    ORDER BY id DESC
  ) AS rn
  FROM ad_insights_cache
)
DELETE FROM ad_insights_cache WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ad_insights_cache_unique'
  ) THEN
    ALTER TABLE ad_insights_cache ADD CONSTRAINT ad_insights_cache_unique
      UNIQUE (ad_account_id, campaign_id, ad_set_id, ad_id, insight_level, date);
  END IF;
END $$;

-- ============================================================
-- 5. Campaign Insights (if exists)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_insights') THEN
    -- Remove duplicates
    EXECUTE '
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY ad_account_id, campaign_id, date
          ORDER BY id DESC
        ) AS rn
        FROM campaign_insights
      )
      DELETE FROM campaign_insights WHERE id IN (
        SELECT id FROM ranked WHERE rn > 1
      )
    ';

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'campaign_insights_unique'
    ) THEN
      EXECUTE 'ALTER TABLE campaign_insights ADD CONSTRAINT campaign_insights_unique
        UNIQUE (ad_account_id, campaign_id, date)';
    END IF;
  END IF;
END $$;
