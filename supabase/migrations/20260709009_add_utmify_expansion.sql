-- ============================================================
-- UTMIFY EXPANSION: Full campaign/adset/ads sync + expanded insights
-- ============================================================

-- 1. campaigns table (master data)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ad_account_id       TEXT NOT NULL,
  campaign_id         TEXT NOT NULL,
  name                TEXT,
  status              TEXT NOT NULL DEFAULT 'ACTIVE',
  effective_status    TEXT,
  objective           TEXT,
  buying_type         TEXT DEFAULT 'AUCTION',
  daily_budget        BIGINT,
  lifetime_budget     BIGINT,
  bid_strategy        TEXT,
  special_ad_categories JSONB DEFAULT '[]'::JSONB,
  created_time        TIMESTAMPTZ,
  updated_time        TIMESTAMPTZ,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, ad_account_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_ad_account ON public.campaigns(ad_account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_campaign_id ON public.campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_account ON public.campaigns(user_id, ad_account_id);

-- 2. ad_sets table
CREATE TABLE IF NOT EXISTS public.ad_sets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ad_account_id       TEXT NOT NULL,
  campaign_id         TEXT NOT NULL,
  ad_set_id           TEXT NOT NULL,
  name                TEXT,
  status              TEXT NOT NULL DEFAULT 'ACTIVE',
  effective_status    TEXT,
  optimization_goal   TEXT,
  billing_event       TEXT,
  bid_strategy        TEXT,
  bid_amount          BIGINT,
  budget_remaining    BIGINT,
  daily_budget        BIGINT,
  lifetime_budget     BIGINT,
  start_time          TIMESTAMPTZ,
  end_time            TIMESTAMPTZ,
  targeting           JSONB DEFAULT '{}'::JSONB,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, ad_account_id, ad_set_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_sets_user_id ON public.ad_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_sets_campaign ON public.ad_sets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_sets_ad_set_id ON public.ad_sets(ad_set_id);

-- 3. ads table (with creative data)
CREATE TABLE IF NOT EXISTS public.ads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ad_account_id       TEXT NOT NULL,
  campaign_id         TEXT NOT NULL,
  ad_set_id           TEXT NOT NULL,
  ad_id               TEXT NOT NULL,
  name                TEXT,
  status              TEXT NOT NULL DEFAULT 'ACTIVE',
  effective_status    TEXT,
  creative_id         TEXT,
  title               TEXT,
  body                TEXT,
  description         TEXT,
  cta_type            TEXT,
  cta_text            TEXT,
  image_url           TEXT,
  thumbnail_url       TEXT,
  video_id            TEXT,
  website_url         TEXT,
  trackings           JSONB DEFAULT '{}'::JSONB,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, ad_account_id, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_ads_user_id ON public.ads(user_id);
CREATE INDEX IF NOT EXISTS idx_ads_campaign ON public.ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ads_ad_set ON public.ads(ad_set_id);
CREATE INDEX IF NOT EXISTS idx_ads_ad_id ON public.ads(ad_id);

-- 4. Expand ad_insights_cache with conversion metrics + adset/ad level
ALTER TABLE public.ad_insights_cache
  ADD COLUMN IF NOT EXISTS conversions NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_value NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_count NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_value NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS initiate_checkout NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS add_to_cart NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS landing_page_views NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_clicks NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frequency NUMERIC,
  ADD COLUMN IF NOT EXISTS quality_ranking TEXT,
  ADD COLUMN IF NOT EXISTS engagement_rate_ranking TEXT,
  ADD COLUMN IF NOT EXISTS conversion_rate_ranking TEXT,
  ADD COLUMN IF NOT EXISTS ad_set_id TEXT,
  ADD COLUMN IF NOT EXISTS ad_id TEXT,
  ADD COLUMN IF NOT EXISTS insight_level TEXT NOT NULL DEFAULT 'campaign';

-- Update unique constraint to support multi-level insights
ALTER TABLE public.ad_insights_cache
  DROP CONSTRAINT IF EXISTS ad_insights_cache_ad_account_id_campaign_id_date_key;

ALTER TABLE public.ad_insights_cache
  ADD CONSTRAINT ad_insights_cache_multi_level_key
    UNIQUE(ad_account_id, campaign_id, ad_set_id, ad_id, insight_level, date);

CREATE INDEX IF NOT EXISTS idx_insights_level ON public.ad_insights_cache(insight_level);
CREATE INDEX IF NOT EXISTS idx_insights_ad_set ON public.ad_insights_cache(ad_set_id);
CREATE INDEX IF NOT EXISTS idx_insights_ad ON public.ad_insights_cache(ad_id);
CREATE INDEX IF NOT EXISTS idx_insights_account_date ON public.ad_insights_cache(ad_account_id, date);

-- 5. order_attributions (materialized order->campaign links)
CREATE TABLE IF NOT EXISTS public.order_attributions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ad_account_id       TEXT NOT NULL,
  campaign_id         TEXT NOT NULL,
  ad_set_id           TEXT,
  ad_id               TEXT,
  attribution_type    TEXT NOT NULL DEFAULT 'utm',
  match_field         TEXT NOT NULL,
  match_value         TEXT NOT NULL,
  attribution_window  TEXT DEFAULT '7d_click',
  attributed_revenue  NUMERIC NOT NULL DEFAULT 0,
  attributed_quantity INTEGER NOT NULL DEFAULT 1,
  attributed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id, campaign_id, attribution_type)
);

CREATE INDEX IF NOT EXISTS idx_attr_order ON public.order_attributions(order_id);
CREATE INDEX IF NOT EXISTS idx_attr_user ON public.order_attributions(user_id);
CREATE INDEX IF NOT EXISTS idx_attr_campaign ON public.order_attributions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_attr_account ON public.order_attributions(ad_account_id);

-- 6. sync_logs (audit trail)
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ad_account_id       TEXT NOT NULL,
  sync_type           TEXT NOT NULL DEFAULT 'full',
  status              TEXT NOT NULL DEFAULT 'running',
  api_calls_made      INTEGER NOT NULL DEFAULT 0,
  rows_synced         INTEGER NOT NULL DEFAULT 0,
  error_message       TEXT,
  duration_ms         INTEGER,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user ON public.sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_account ON public.sync_logs(ad_account_id);

-- 7. campaign_costs (per-campaign cost overrides)
CREATE TABLE IF NOT EXISTS public.campaign_costs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ad_account_id           TEXT NOT NULL,
  campaign_id             TEXT NOT NULL,
  tax_percentage_override NUMERIC,
  production_cost_override NUMERIC,
  custom_costs            JSONB DEFAULT '[]'::JSONB,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, ad_account_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_camp_costs_user ON public.campaign_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_camp_costs_campaign ON public.campaign_costs(ad_account_id, campaign_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- ad_sets
ALTER TABLE public.ad_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ad sets" ON public.ad_sets FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- ads
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ads" ON public.ads FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- order_attributions
ALTER TABLE public.order_attributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own attributions" ON public.order_attributions FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- sync_logs
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own sync logs" ON public.sync_logs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users insert own sync logs" ON public.sync_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- campaign_costs
ALTER TABLE public.campaign_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own campaign costs" ON public.campaign_costs FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================
-- GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_sets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_attributions TO authenticated;
GRANT SELECT, INSERT ON public.sync_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_costs TO authenticated;
