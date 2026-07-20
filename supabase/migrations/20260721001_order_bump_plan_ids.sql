-- Add plan_ids to product_order_bumps for plan-specific order bumps
-- Empty array = applies to all plans; non-empty = only those plans

ALTER TABLE public.product_order_bumps
  ADD COLUMN IF NOT EXISTS plan_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
