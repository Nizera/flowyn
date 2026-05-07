'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { 
  CreditCard, 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Banknote,
  ShieldCheck,
  ArrowRight,
  Wallet
} from 'lucide-react'
import { Suspense } from 'react'

interface AsaasStatus {
  connected: boolean
  wallet_id: string | null
  onboarding_status: string
}

function PaymentsContent() {
  const [status, setStatus] = useState<AsaasStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [walletIdInput, setWalletIdInput] = useState('')

  useEffect(() => {
    checkStatus()
  }, [])

  async function checkStatus() {
    setLoading(true)
    try {
      const res = await fetch('/api/asaas/status')
      const data = await res.json()
      setStatus(data)
      if (data.wallet_id) {
        setWalletIdInput(data.wallet_id)
      }
    } catch (err) {
      setError('Erro ao verificar status da conta')
    }
    setLoading(false)
  }

  async function handleSaveWallet() {
    if (!walletIdInput) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/asaas/connect', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_id: walletIdInput })
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao salvar Wallet ID')
      } else {
        setStatus(prev => prev ? { ...prev, connected: true, wallet_id: walletIdInput } : null)
      }
    } catch (err) {
      setError('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#00e88a]" />
      </div>
    )
  }

  const isActive = status?.connected && status?.wallet_id

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-[#00e88a]" />
          Configurações de Pagamento
        </h1>
        <p className="text-white/50 mt-1">
          Configure sua conta Asaas para receber pagamentos e comissões via Split.
        </p>
      </div>

      {/* Connection Status Card */}
      <div className="bg-[#111111] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        {/* Status Header */}
        <div className={`px-6 py-5 border-b ${isActive ? 'bg-[#00e88a]/5 border-white/5' : 'bg-[#0a0a0a] border-white/5'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-[#00e88a]/10' : 'bg-white/5 border border-white/10'}`}>
                {isActive ? (
                  <CheckCircle2 className="w-5 h-5 text-[#00e88a]" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-white/40" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-white">
                  {isActive ? 'Conta Asaas Configurada' : 'Conta não configurada'}
                </h3>
                <p className="text-sm text-white/50">
                  {isActive 
                    ? 'Seu Wallet ID está configurado para splits' 
                    : 'Insira seu Wallet ID do Asaas para começar'}
                </p>
              </div>
            </div>
            <button
              onClick={checkStatus}
              className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              title="Atualizar status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Details */}
        <div className="p-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="walletId" className="block text-sm font-semibold text-white/70 mb-2 flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Asaas Wallet ID
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  id="walletId"
                  value={walletIdInput}
                  onChange={(e) => setWalletIdInput(e.target.value)}
                  className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] transition-all outline-none text-sm font-mono" 
                  placeholder="Ex: 12345678-abcd-1234-abcd-1234567890ab" 
                />
                <button 
                  onClick={handleSaveWallet}
                  disabled={saving || !walletIdInput}
                  className="bg-[#00e88a] hover:bg-[#00e88a]/90 text-black font-bold px-6 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,232,138,0.2)]"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </button>
              </div>
              <p className="text-xs text-white/40 mt-2">
                Você encontra seu Wallet ID nas configurações da sua conta Asaas.
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-4 border-t border-white/5 pt-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#00e88a]/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#00e88a]/20">
                  <Banknote className="w-4 h-4 text-[#00e88a]" />
                </div>
                <div>
                  <h4 className="font-medium text-white text-sm">Split Automático</h4>
                  <p className="text-sm text-white/50">Receba sua parte instantaneamente em cada venda, sem esperas.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#00e88a]/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#00e88a]/20">
                  <ShieldCheck className="w-4 h-4 text-[#00e88a]" />
                </div>
                <div>
                  <h4 className="font-medium text-white text-sm">Segurança Asaas</h4>
                  <p className="text-sm text-white/50">Seus pagamentos são processados pela maior conta digital do Brasil.</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-4">
              <p className="text-sm text-white/60">
                <ShieldCheck className="w-4 h-4 inline mr-1 text-[#00e88a]" />
                Precisa de ajuda para encontrar seu Wallet ID? 
                <a href="https://ajuda.asaas.com" target="_blank" className="text-[#00e88a] hover:underline ml-1 inline-flex items-center gap-1">
                  Ver tutorial <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PaymentsSettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#00e88a]" />
      </div>
    }>
      <PaymentsContent />
    </Suspense>
  )
}

