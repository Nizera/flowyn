-- Migration v27: Add missing columns to orders table
-- These columns are referenced by application code but were never added via migration.

-- customer_user_id: Links order to the customer's auth user (used in RLS policies)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- producer_amount: Stores the producer's portion of the payment
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS producer_amount NUMERIC DEFAULT 0;

-- transfer_status: Tracks Asaas split payment transfer status
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS transfer_status TEXT;

-- Index for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_user_id ON public.orders(customer_user_id);
