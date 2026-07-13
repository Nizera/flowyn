-- Add plan column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';

COMMENT ON COLUMN public.profiles.plan IS 'Subscription plan: free, pro, scale';
