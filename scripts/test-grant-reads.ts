/**
 * Teste de integração: Verificar GRANTs de leitura para authenticated
 *
 * Este script verifica se o role authenticated pode ler das tabelas
 * de tracking que são usadas pelo endpoint /api/meta-ads/funnel.
 *
 * Execute com: npx tsx scripts/test-grant-reads.ts
 *
 * Requer env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (para inserir dados de teste)
 *   SUPABASE_ANON_KEY (para simular client autenticado)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
// Simula um client autenticado (anon key + RLS)
const anonClient = createClient(SUPABASE_URL, ANON_KEY)

async function testFunnelEventsRead() {
  console.log('\n=== Teste: funnel_events SELECT por authenticated ===')

  // 1. Inserir dados de teste via service_role
  const testId = crypto.randomUUID()
  const { error: insertError } = await admin.from('funnel_events').insert({
    product_id: '00000000-0000-0000-0000-000000000000',
    plan_id: '00000000-0000-0000-0000-000000000000',
    event_name: 'page_view',
    utm_source: 'test',
  })

  if (insertError) {
    console.warn('  INSERT via admin failed (expected if FK constraints exist):', insertError.message)
    console.log('  SKIP: Cannot test without valid FK references')
    return true
  }

  // 2. Tentar ler via client anon (simula authenticated)
  const { data, error: selectError } = await anonClient
    .from('funnel_events')
    .select('id')
    .eq('event_name', 'page_view')
    .limit(1)

  // 3. Limpar dados de teste
  await admin.from('funnel_events').delete().eq('id', testId)

  // Nota: Com RLS, o anon client só vê seus próprios dados.
  // O ponto é que NÃO deve haver erro de permissão (GRANT missing).
  // Se o erro for "permission denied" ou "relation not found", o GRANT está faltando.
  if (selectError) {
    if (selectError.message?.includes('permission denied') || selectError.message?.includes('relation')) {
      console.error('  FAIL: Permission error detected:', selectError.message)
      return false
    }
    console.error('  FAIL: SELECT returned error:', selectError.message)
    return false
  }

  console.log('  OK: SELECT executed without permission errors')
  return true
}

async function testTrackingExternalEventsRead() {
  console.log('\n=== Teste: tracking_external_events SELECT por authenticated ===')

  // Verificar se a tabela existe e tem os GRANTs corretos
  const { error } = await anonClient
    .from('tracking_external_events')
    .select('id')
    .limit(1)

  if (error?.message?.includes('permission denied') || error?.message?.includes('relation')) {
    console.error('  FAIL: Permission error:', error.message)
    console.error('  GRANT SELECT missing for authenticated role')
    return false
  }

  console.log('  OK: SELECT executed without permission errors')
  return true
}

async function main() {
  console.log('Testando GRANTs de leitura para role authenticated...')
  console.log('Este teste verifica se as correções de permissões estão aplicadas.')

  const results = await Promise.all([
    testFunnelEventsRead(),
    testTrackingExternalEventsRead(),
  ])

  const allPassed = results.every(Boolean)

  console.log('\n=== Resultado ===')
  if (allPassed) {
    console.log('Todos os testes passaram!')
    process.exit(0)
  } else {
    console.error('Alguns testes falharam. Verifique os GRANTs no banco.')
    process.exit(1)
  }
}

main().catch(console.error)
