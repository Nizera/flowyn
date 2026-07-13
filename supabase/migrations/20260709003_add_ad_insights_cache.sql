-- Ad Insights Cache: stores daily campaign metrics from Meta API

CREATE TABLE IF NOT EXISTS public.ad_insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  spend NUMERIC NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  cpc NUMERIC,
  cpm NUMERIC,
  ctr NUMERIC,
  cost_per_lead NUMERIC,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ad_account_id, campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ad_insights_cache_account ON public.ad_insights_cache(ad_account_id);
CREATE INDEX IF NOT EXISTS idx_ad_insights_cache_campaign ON public.ad_insights_cache(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_insights_cache_date ON public.ad_insights_cache(date);

COMMENT ON TABLE public.ad_insights_cache IS 'Daily campaign metrics from Meta Marketing API';
COMMENT ON COLUMN public.ad_insights_cache.spend IS 'Total amount spent in the campaign on this date';

ALTER TABLE public.ad_insights_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ad_insights_cache FROM anon, authenticated;
GRANT ALL ON public.ad_insights_cache TO service_role;
