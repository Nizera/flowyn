-- Track Meta API usage per user for rate limiting
CREATE TABLE IF NOT EXISTS public.meta_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  calls_made INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_api_usage_user_window ON public.meta_api_usage(user_id, window_start);

COMMENT ON TABLE public.meta_api_usage IS 'Track Meta API calls per user for rate limiting (200 calls/hour limit)';

ALTER TABLE public.meta_api_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_api_usage FROM anon, authenticated;
GRANT ALL ON public.meta_api_usage TO service_role;

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION check_meta_api_rate_limit(
  p_user_id UUID,
  p_max_calls INTEGER DEFAULT 200
)
RETURNS JSONB AS $$
DECLARE
  window_start TIMESTAMPTZ;
  current_usage INTEGER;
  result JSONB;
BEGIN
  -- Window is the current hour
  window_start := date_trunc('hour', NOW());
  
  -- Get current usage in this window
  SELECT COALESCE(SUM(calls_made), 0) INTO current_usage
  FROM public.meta_api_usage
  WHERE user_id = p_user_id
    AND window_start >= date_trunc('hour', NOW());
  
  IF current_usage >= p_max_calls THEN
    result := jsonb_build_object(
      'allowed', false,
      'current_usage', current_usage,
      'max_calls', p_max_calls,
      'remaining', 0,
      'reset_at', (date_trunc('hour', NOW()) + INTERVAL '1 hour')
    );
  ELSE
    -- Record the call
    INSERT INTO public.meta_api_usage (user_id, endpoint, calls_made, window_start)
    VALUES (p_user_id, 'sync', 1, NOW());
    
    result := jsonb_build_object(
      'allowed', true,
      'current_usage', current_usage + 1,
      'max_calls', p_max_calls,
      'remaining', p_max_calls - current_usage - 1,
      'reset_at', (date_trunc('hour', NOW()) + INTERVAL '1 hour')
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current usage without incrementing
CREATE OR REPLACE FUNCTION get_meta_api_usage(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  current_usage INTEGER;
BEGIN
  SELECT COALESCE(SUM(calls_made), 0) INTO current_usage
  FROM public.meta_api_usage
  WHERE user_id = p_user_id
    AND window_start >= date_trunc('hour', NOW());
  
  RETURN jsonb_build_object(
    'current_usage', current_usage,
    'max_calls', 200,
    'remaining', GREATEST(0, 200 - current_usage),
    'reset_at', (date_trunc('hour', NOW()) + INTERVAL '1 hour')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
