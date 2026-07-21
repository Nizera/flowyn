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

### `supabase/migrations/20260721002_add_capi_access_token_to_pixels.sql`
Adiciona coluna `capi_access_token TEXT` em `pixels` para permitir que cada produtor
cadastre o Access Token da Conversions API específico do seu pixel (encriptado em
AES-256-GCM). Sem essa coluna, o CAPI vai pular pixels sem token próprio.

```sql
ALTER TABLE public.pixels
  ADD COLUMN IF NOT EXISTS capi_access_token TEXT;

COMMENT ON COLUMN public.pixels.capi_access_token IS 'Access Token da Conversions API da Meta (encriptado). Opcional. Aplicável a platform=meta.';
```
