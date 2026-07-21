# Migrations pendentes — aplicar via Supabase Dashboard SQL Editor

> Este ambiente de desenvolvimento não tem acesso de rede ao Supabase. As migrations
> abaixo estão criadas no repo mas ainda precisam ser aplicadas manualmente no banco.

## Como aplicar

1. Abra https://supabase.com/dashboard/project/nehoyrpmapzhecxhyvvd/sql/new
2. Cole e execute o conteúdo do arquivo `.sql` listado abaixo, um por vez.

## Pendentes

### `supabase/migrations/20260721001_add_sync_lock_to_ad_accounts.sql`
Adiciona coluna `sync_lock_until TIMESTAMPTZ` em `ad_accounts` para prevenir syncs
paralelos concorrentes. Sem essa coluna, o código em `src/lib/meta-sync.ts` vai logar
um warning e seguir sem lock (não quebra, mas a W9 fica desprotegida).

```sql
ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS sync_lock_until TIMESTAMPTZ;

COMMENT ON COLUMN public.ad_accounts.sync_lock_until IS 'Timestamp até o qual um sync está em andamento. NULL ou no passado = livre.';
```
