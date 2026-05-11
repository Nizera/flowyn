'use client'

import { useState, useEffect } from 'react'
import { Wallet, ArrowUpRight, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function WalletPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [pixKeyType, setPixKeyType] = useState('CPF')
  const [pixKey, setPixKey] = useState('')

  useEffect(() => {
    fetchBalance()
  }, [])

  async function fetchBalance() {
    try {
      setLoading(true)
      const res = await fetch('/api/asaas/wallet/balance')
      const data = await res.json()
      
      if (res.ok) {
        setBalance(data.balance)
      } else {
        setError(data.error || 'Erro ao carregar saldo.')
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      setError('Insira um valor válido para saque.')
      return
    }

    if (balance !== null && Number(withdrawAmount) > balance) {
      setError('Saldo insuficiente.')
      return
    }

    try {
      setWithdrawing(true)
      const res = await fetch('/api/asaas/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: Number(withdrawAmount),
          pixKeyType,
          pixKey
        })
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess('Saque solicitado com sucesso! O valor será transferido em breve.')
        setWithdrawAmount('')
        setPixKey('')
        fetchBalance() // Atualiza o saldo
      } else {
        setError(data.error || 'Erro ao solicitar saque.')
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão.')
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Carteira</h1>
        <p className="text-zinc-400">Gerencie seu saldo e solicite saques para sua conta bancária via Pix.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card de Saldo */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 text-zinc-400 mb-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Wallet className="w-5 h-5 text-emerald-500" />
              </div>
              <span className="font-medium">Saldo Disponível</span>
            </div>
            
            {loading ? (
              <div className="animate-pulse h-10 bg-zinc-800 rounded w-1/2 mt-2"></div>
            ) : (
              <div className="text-4xl font-bold text-white">
                {balance !== null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balance) : 'R$ --,--'}
              </div>
            )}
            <p className="text-sm text-zinc-500 mt-2">
              Taxa de transferência (Asaas): R$ 5,00 por saque
            </p>
          </div>
        </div>

        {/* Formulário de Saque */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Solicitar Saque</h2>
          
          <form onSubmit={handleWithdraw} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{success}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Valor do Saque</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">R$</span>
                <input
                  type="number"
                  step="0.01"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  disabled={withdrawing || loading || balance === 0 || balance === null}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Tipo de Chave Pix</label>
                <select
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value)}
                  disabled={withdrawing}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="PHONE">Telefone</option>
                  <option value="EVP">Chave Aleatória</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Chave Pix</label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  disabled={withdrawing}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Sua chave Pix"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={withdrawing || loading || balance === 0 || balance === null}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {withdrawing ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ArrowUpRight className="w-5 h-5" />
                  Transferir Dinheiro
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
