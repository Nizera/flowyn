'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Clock, ExternalLink, Wallet } from 'lucide-react'

export default function WalletPage() {
  const [balance, setBalance] = useState<{ available: number; pending: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchBalance() {
    try {
      setLoading(true)
      const res = await fetch('/api/asaas/balance')
      const data = await res.json()

      if (res.ok) {
        setBalance({
          available: Number(data.available || 0),
          pending: Number(data.pending || 0),
        })
      } else {
        setError(data.error || 'Erro ao carregar saldo.')
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalance()
  }, [])

  function handleOpenDashboard() {
    setDashboardLoading(true)
    window.open('https://sandbox.asaas.com', '_blank')
    setDashboardLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Carteira</h1>
        <p className="text-zinc-400">Gerencie seu saldo e acompanhe seus recebíveis através da Asaas.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Wallet className="w-24 h-24 text-emerald-500" />
          </div>

          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center gap-3 text-zinc-400 mb-4">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Wallet className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="font-medium">Saldo disponível</span>
              </div>

              {loading ? (
                <div className="animate-pulse h-10 bg-zinc-800 rounded w-1/2 mt-2" />
              ) : (
                <div className="text-4xl font-bold text-white">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balance?.available || 0)}
                </div>
              )}
              <p className="text-sm text-zinc-500 mt-2">Saldo informado pela conta Asaas conectada.</p>
            </div>

            <button
              onClick={handleOpenDashboard}
              disabled={dashboardLoading || loading || balance === null}
              className="mt-8 w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-semibold py-3 rounded-lg transition-all active:scale-[0.98]"
            >
              {dashboardLoading ? (
                <div className="w-5 h-5 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
              ) : (
                <>
                  <ExternalLink className="w-5 h-5" />
                  Abrir painel Asaas
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Clock className="w-24 h-24 text-amber-500" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 text-zinc-400 mb-4">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <span className="font-medium">Saldo pendente</span>
            </div>

            {loading ? (
              <div className="animate-pulse h-10 bg-zinc-800 rounded w-1/2 mt-2" />
            ) : (
              <div className="text-4xl font-bold text-zinc-300">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balance?.pending || 0)}
              </div>
            )}
            <p className="text-sm text-zinc-500 mt-2">Reservado para recebíveis ainda não disponíveis.</p>
          </div>

          <div className="mt-8 p-4 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
            <p className="text-xs text-zinc-500 leading-relaxed">
              O prazo de compensação depende do método de pagamento e das regras da sua conta Asaas.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-6">
        <div className="flex gap-4">
          <div className="p-2 bg-blue-500/10 rounded-lg h-fit">
            <AlertCircle className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">Sobre os saques</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              A Flowyn utiliza subcontas Asaas para receber suas vendas no checkout. No painel Asaas voce acompanha saldo, conta bancaria e transferencias.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
