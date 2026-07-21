-- CORREÇÃO W9 (auditoria tracking): sem lock, dois /sync-expanded calls paralelos
-- para a mesma ad_account_id corriam DELETE–then-refetch concorrentemente,
-- podendo gerar rows órfãs/parciais sem o user saber. Agora usamos um row-level
-- advisory lock via timestamp em ad_accounts.sync_lock_until — a função de sync
-- faz UPSERT condicional (só inicia se lock estiver expirado) e libera ao final.
ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS sync_lock_until TIMESTAMPTZ;

COMMENT ON COLUMN public.ad_accounts.sync_lock_until IS 'Timestamp até o qual um sync está em andamento. NULL ou no passado = livre. Evita syncs paralelos concorrentes.';
