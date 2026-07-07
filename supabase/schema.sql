-- ============================================================================
-- ATTENTION: Este arquivo é um snapshot histórico e está DESATUALIZADO.
-- O estado real do banco é determinado pela sequência de migrations:
--   migration_v1_*.sql → migration_v24_*.sql
-- Nunca aplique este arquivo diretamente em um banco novo.
-- Para provisionar, aplique todas as migrations em ordem.
-- ============================================================================

-- Setup basic types for our platform
CREATE TYPE user_role AS ENUM ('affiliate', 'producer', 'customer');

-- Create Profiles Table (extends Auth.Users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role user_role NOT NULL,
  full_name TEXT,
  document_number TEXT, -- CPF/CNPJ
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone." 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Create a function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    new.id,
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'affiliate'::user_role),
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Products (SaaS)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  site_url TEXT,
  commission_rate NUMERIC NOT NULL DEFAULT 50,
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Plans for Products
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are viewable by everyone." 
ON public.products FOR SELECT USING (true);

CREATE POLICY "Producers can insert their own products." 
ON public.products FOR INSERT WITH CHECK (
  auth.uid() = owner_id AND 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'producer')
);

CREATE POLICY "Producers can update their own products." 
ON public.products FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Producers can delete their own products." 
ON public.products FOR DELETE USING (auth.uid() = owner_id);

-- RLS for plans
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are viewable by everyone." 
ON public.plans FOR SELECT USING (true);

CREATE POLICY "Producers can manage plans for their products." 
ON public.plans FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_id AND p.owner_id = auth.uid()
  )
);

-- Affiliations
CREATE TABLE public.affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  tracking_id TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(affiliate_id, product_id)
);

ALTER TABLE public.affiliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliations viewable by owner and product owners"
ON public.affiliations FOR SELECT USING (
  auth.uid() = affiliate_id OR 
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.owner_id = auth.uid())
);

CREATE POLICY "Affiliates can insert their own affiliations"
ON public.affiliations FOR INSERT WITH CHECK (
  auth.uid() = affiliate_id AND 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'affiliate')
);

CREATE POLICY "Affiliates can update their own affiliations status"
ON public.affiliations FOR UPDATE USING (auth.uid() = affiliate_id);

-- Orders / Transactions
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  affiliate_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, refunded
  tracking_id TEXT,
  is_sandbox BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers can view orders for their products"
ON public.orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = orders.product_id AND p.owner_id = auth.uid())
);

CREATE POLICY "Affiliates can view their commissioned orders"
ON public.orders FOR SELECT USING (auth.uid() = affiliate_id);

-- Orders are written only by the service role (checkout/webhooks); no anon/authenticated UPDATE/INSERT.

-- Webhook tracking columns on orders
-- ALTER TABLE public.orders ADD COLUMN webhook_status TEXT NOT NULL DEFAULT 'pending';
-- ALTER TABLE public.orders ADD COLUMN webhook_attempts INTEGER NOT NULL DEFAULT 0;

-- Webhook delivery logs
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  webhook_url TEXT NOT NULL,
  request_payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers can view webhook logs for their products"
ON public.webhook_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = webhook_logs.product_id AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "System can insert webhook logs"
ON public.webhook_logs FOR INSERT WITH CHECK (true);
