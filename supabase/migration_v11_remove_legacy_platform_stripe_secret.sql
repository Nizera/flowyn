-- Migration v11: remove final legacy Stripe setting

ALTER TABLE public.platform_settings
  DROP COLUMN IF EXISTS stripe_webhook_secret;
