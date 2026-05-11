-- Migration: Add missing fields to profiles for Asaas Account creation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS complement TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_type TEXT; -- INDIVIDUAL, MEI, LIMITED, etc.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS income_value NUMERIC; -- Monthly income or revenue
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT;
