-- ============================================================
-- Automation Rules for Meta Ads
-- ============================================================

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ad_account_id       TEXT NOT NULL,
  name                TEXT NOT NULL,
  enabled             BOOLEAN NOT NULL DEFAULT true,
  entity_level        TEXT NOT NULL DEFAULT 'campaign',
  entity_ids          TEXT[] DEFAULT '{}',

  -- Condition
  condition_metric    TEXT NOT NULL,
  condition_operator  TEXT NOT NULL,
  condition_value     NUMERIC NOT NULL,
  condition_period    INTEGER NOT NULL DEFAULT 24,

  -- Action
  action_type         TEXT NOT NULL,
  action_value        NUMERIC,
  action_value_type   TEXT DEFAULT 'percentage',

  -- Execution tracking
  last_triggered_at   TIMESTAMPTZ,
  trigger_count       INTEGER NOT NULL DEFAULT 0,
  cooldown_hours      INTEGER NOT NULL DEFAULT 6,

  -- Notifications
  notify_whatsapp     BOOLEAN NOT NULL DEFAULT false,
  notify_email        BOOLEAN NOT NULL DEFAULT false,
  webhook_url         TEXT,
  webhook_secret      TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_user ON public.automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_account ON public.automation_rules(ad_account_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON public.automation_rules(enabled) WHERE enabled = true;

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own automation rules"
  ON public.automation_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own automation rules"
  ON public.automation_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automation rules"
  ON public.automation_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own automation rules"
  ON public.automation_rules FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Automation Rules Log
-- ============================================================

CREATE TABLE IF NOT EXISTS public.automation_rules_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id             UUID REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL,
  ad_account_id       TEXT NOT NULL,
  entity_level        TEXT NOT NULL,
  entity_id           TEXT NOT NULL,
  entity_name         TEXT,
  condition_met       JSONB,
  action_taken        TEXT NOT NULL,
  action_result       TEXT DEFAULT 'success',
  action_error        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_log_rule ON public.automation_rules_log(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_log_user ON public.automation_rules_log(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_log_created ON public.automation_rules_log(created_at);

ALTER TABLE public.automation_rules_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own automation logs"
  ON public.automation_rules_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert automation logs"
  ON public.automation_rules_log FOR INSERT
  WITH CHECK (true);
