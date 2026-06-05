'use client'

import { useState } from 'react'
import { Play, Activity, Clock, CheckCircle2, XCircle, AlertTriangle, ShoppingCart } from 'lucide-react'
import { testWebhookAction, simulatePurchaseAction } from '@/app/(app)/dashboard/products/[id]/integrations/actions'

export function WebhookTestPanel({ productId, currentUrl, plans }: { productId: string, currentUrl: string, plans: any[] }) {
  const [loading, setLoading] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [result, setResult] = useState<{ status: number | null, timeMs: number, success: boolean, error?: string, body?: string } | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id || '')

  async function handleTest() {
    if (!currentUrl) return alert('Configure uma URL de webhook primeiro.')
    
    setLoading(true)
    setResult(null)
    try {
      const res = await testWebhookAction(productId, currentUrl)
      setResult({
        status: res.status ?? null,
        timeMs: res.timeMs ?? 0,
        success: res.success ?? false,
        error: res.error,
        body: res.body
      })
    } catch (e: any) {
      setResult({
        status: null,
        timeMs: 0,
        success: false,
        error: e.message || 'Erro de rede'
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSimulate() {
    if (!currentUrl) return alert('Configure uma URL de webhook primeiro.')
    if (!selectedPlanId) return alert('Você precisa criar um plano de venda primeiro para simular uma compra.')

    setSimulating(true)
    try {
      const res = await simulatePurchaseAction(productId, selectedPlanId)
      if (res.success) {
        alert('Simulação de compra enviada com sucesso! Verifique os logs de webhook abaixo.')
      } else {
        alert('Falha na simulação: ' + res.error)
      }
    } catch (e: any) {
      alert('Erro na simulação: ' + e.message)
    } finally {
      setSimulating(false)
    }
  }

  return (
    <div className="bg-[#111111] border border-white/10 rounded-2xl shadow-xl mb-10 overflow-hidden">
      <div className="p-6 border-b border-white/5 bg-[#0a0a0a]">
        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#00e88a]" />
          Testes e Simulação
        </h3>
        <p className="text-sm text-white/50">
          Valide a sua integração antes de receber clientes reais.
        </p>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Test Ping */}
        <div className="space-y-4 border-r-0 md:border-r border-white/5 md:pr-6">
          <h4 className="font-semibold text-white/80 text-sm">1. Ping Test (Payload Fictício)</h4>
          <p className="text-xs text-white/50 mb-4">
            Dispara um evento de teste na sua URL instantaneamente para validar conectividade e tempo de resposta.
          </p>
          <button 
            onClick={handleTest}
            disabled={loading || !currentUrl}
            className="w-full flex items-center justify-center gap-2 bg-[#00e88a]/10 hover:bg-[#00e88a]/20 text-[#00e88a] font-bold py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 border border-[#00e88a]/20"
          >
            {loading ? <Clock className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {loading ? 'Disparando...' : 'Enviar Payload de Teste'}
          </button>

          {result && (
            <div className={`mt-4 p-4 rounded-xl border ${result.success ? (result.timeMs > 3000 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#00e88a]/10 border-[#00e88a]/30') : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="flex items-center gap-2 mb-3">
                {result.success ? (
                  result.timeMs > 3000 ? <AlertTriangle className="w-5 h-5 text-amber-500" /> : <CheckCircle2 className="w-5 h-5 text-[#00e88a]" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span className={`font-bold text-sm ${result.success ? (result.timeMs > 3000 ? 'text-amber-500' : 'text-[#00e88a]') : 'text-red-500'}`}>
                  {result.success ? 'Conexão Bem-sucedida' : 'Falha na Conexão'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                <div className="bg-[#0a0a0a] rounded p-2 border border-white/10">
                  <span className="block text-white/50 font-medium mb-0.5">Status HTTP</span>
                  <span className={`font-bold ${result.success ? 'text-[#00e88a]' : 'text-red-500'}`}>{result.status || 'N/A'}</span>
                </div>
                <div className="bg-[#0a0a0a] rounded p-2 border border-white/10">
                  <span className="block text-white/50 font-medium mb-0.5">Tempo de Resposta</span>
                  <span className={`font-bold ${result.timeMs > 3000 ? 'text-amber-500' : 'text-white/80'}`}>{result.timeMs}ms</span>
                </div>
              </div>

              {result.error && (
                <div className="text-xs text-red-400 bg-[#0a0a0a] p-2 rounded border border-red-500/30 mb-2">
                  <span className="font-bold">Erro: </span> {result.error}
                </div>
              )}
              
              {result.body && (
                <div>
                  <span className="block text-[10px] uppercase font-bold text-white/40 mb-1">Body da Resposta</span>
                  <pre className="text-[10px] text-white/60 bg-[#0a0a0a] p-2 rounded border border-white/10 max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {result.body}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sandbox Simulation */}
        <div className="space-y-4">
          <h4 className="font-semibold text-white/80 text-sm">2. Simulação End-to-End (Sandbox)</h4>
          <p className="text-xs text-white/50 mb-4">
            Simula uma compra real no sistema (R$ 0,00). Util para testar se a sua entrega externa recebe o cliente corretamente com o identificador do plano.
          </p>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-white/50 mb-1">Plano para Simular</label>
              <select 
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-[#00e88a]"
              >
                {plans.length === 0 && <option value="">Nenhum plano criado</option>}
                {plans.map(p => (
                  <option key={p.id} value={p.id} className="bg-[#111111]">{p.name} ({p.plan_identifier || 'Sem identifier'})</option>
                ))}
              </select>
            </div>
            
            <button 
              onClick={handleSimulate}
              disabled={simulating || plans.length === 0 || !currentUrl}
              className="w-full flex items-center justify-center gap-2 bg-[#00e88a] hover:bg-[#00e88a]/90 text-black font-bold py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(0,232,138,0.3)] hover:shadow-[0_0_25px_rgba(0,232,138,0.5)]"
            >
              {simulating ? <Clock className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              {simulating ? 'Simulando...' : 'Simular Venda Completa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
