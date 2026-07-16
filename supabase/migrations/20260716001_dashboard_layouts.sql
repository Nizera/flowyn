-- Migration 20260716001: Dashboard layouts for customizable dashboard
CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Principal',
  layout JSONB NOT NULL DEFAULT '[]',
  visible_widgets JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One layout per user (for now)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_layouts_user_id ON public.dashboard_layouts(user_id);

-- RLS
ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own dashboard layout"
  ON public.dashboard_layouts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dashboard layout"
  ON public.dashboard_layouts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboard layout"
  ON public.dashboard_layouts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboard layout"
  ON public.dashboard_layouts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT ALL ON public.dashboard_layouts TO authenticated;

COMMENT ON TABLE public.dashboard_layouts IS 'Customizable dashboard layout per user - stores widget positions and visibility';
COMMENT ON COLUMN public.dashboard_layouts.layout IS 'Array of {i, x, y, w, h} for react-grid-layout';
COMMENT ON COLUMN public.dashboard_layouts.visible_widgets IS 'Array of widget IDs currently visible on dashboard';
