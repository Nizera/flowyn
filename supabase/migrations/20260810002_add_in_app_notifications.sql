-- In-app notifications table
-- Persists notifications so they survive page reloads

CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  href TEXT,
  notification_type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Index for quick lookup by user (unread first)
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_id
  ON public.in_app_notifications(user_id, is_read, created_at DESC);

-- RLS policies
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.in_app_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.in_app_notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.in_app_notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all notifications (for creating from webhooks/fulfillment)
CREATE POLICY "Service role can manage all notifications"
  ON public.in_app_notifications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to create notification (called from server-side code)
CREATE OR REPLACE FUNCTION create_in_app_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_href TEXT DEFAULT NULL,
  p_type TEXT DEFAULT 'info',
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.in_app_notifications (user_id, title, body, href, notification_type, metadata, expires_at)
  VALUES (p_user_id, p_title, p_body, p_href, p_type, p_metadata, p_expires_at)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;
