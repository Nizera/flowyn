-- CORREÇÃO: Restaurar GRANTs SELECT removidos acidentalmente
--
-- Problema: A migration 20260720001 executou REVOKE ALL em funnel_events
-- para o role authenticated (intenção era revogar INSERT do anon). Isso
-- quebrou a leitura de funnel_events via client autenticado no endpoint
-- /api/meta-ads/funnel, que usa createClient() normal (não admin).
--
-- A policy de SELECT para authenticated existe e está correta (20260715003),
-- mas sem o GRANT de base, a RLS nunca é avaliada — a tabela simplesmente
-- não retorna dados para o role authenticated.
--
-- Para tracking_external_events: a migration 20260721003 criou a policy
-- SELECT para authenticated mas nunca deu GRANT nenhum para esse role.
--
-- Solução: Dar GRANT SELECT (somente leitura) para authenticated.
-- INSERT continua restrito a service_role (via RLS + GRANT).

-- Restaurar SELECT em funnel_events
GRANT SELECT ON public.funnel_events TO authenticated;

-- Conceder SELECT em tracking_external_events (nunca foi dado)
GRANT SELECT ON public.tracking_external_events TO authenticated;
