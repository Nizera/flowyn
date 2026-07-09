-- Meta Ads account connections (OAuth)

CREATE TABLE IF NOT EXISTS public.ad_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL DEFAULT 'meta',
  ad_account_id   TEXT NOT NULL,
  ad_account_name TEXT,
  access_token    TEXT NOT NULL,
  pixel_id        TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_sync_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, platform, ad_account_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_user_id ON public.ad_accounts(user_id);

COMMENT ON TABLE public.ad_accounts IS 'Connected ad accounts via OAuth (Meta, Google, etc.)';
COMMENT ON COLUMN public.ad_accounts.access_token IS 'Encrypted access token (AES-256-GCM)';

ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ad accounts"
  ON public.ad_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);