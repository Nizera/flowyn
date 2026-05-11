-- Script para remover as colunas não utilizadas da Stripe no banco de dados da Flowyn

-- Tabela Profiles
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS stripe_account_id;

-- Tabela Plans
ALTER TABLE public.plans 
DROP COLUMN IF EXISTS stripe_price_id;

-- Tabela Orders
ALTER TABLE public.orders 
DROP COLUMN IF EXISTS stripe_payment_id,
DROP COLUMN IF EXISTS stripe_payment_intent_id,
DROP COLUMN IF EXISTS stripe_session_id;

-- Opcional: Para ter certeza de que as definições no cache do Supabase estão limpas
NOTIFY pgrst, 'reload schema';
