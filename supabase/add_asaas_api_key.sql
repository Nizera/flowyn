-- Adiciona a coluna para armazenar a API Key da Asaas (usada para Saques)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS asaas_api_key TEXT;
