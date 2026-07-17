'use client'

import { useEffect, useState } from 'react'
import { Copy, Users, DollarSign, Clock, CheckCircle, Wallet, AlertTriangle } from 'lucide-react'

type ReferralStats = {
  total_referred: number
  total_commission: number
  paid_commission: number
  pending_commission: number
}

type Referral = {
  id: string
  referral_code: string
  created_at: string
  first_payment_at: string | null
}

type Commission = {
  id: string
  amount: number
  status: string
  created_at: string
  paid_at: string | null
  payment_id: string
}

type ReferralData = {
  code: string | null
  wallet_connected: boolean
  stats: ReferralStats
  commissions: Commission[]
  referrals: Referral[]
}

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function ReferralsPage() {
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/referrals/dashboard')
      if (!res.ok) {
        setLoadError('Erro ao carregar dados.')
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setLoadError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  async function generateCode() {
    setGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/referrals/track', { method: 'POST' })
      if (!res.ok) {
        const json = await res.json()
        setGenerateError(json.error || 'Erro ao gerar código.')
        return
      }
      const json = await res.json()
      if (json.code) {
        setData(prev => prev ? { ...prev, code: json.code } : null)
      }
    } catch {
      setGenerateError('Erro de conexão.')
    } finally {
      setGenerating(false)
    }
  }

  function copyCode() {
    if (!data?.code) return
    const url = `${window.location.origin}/register?ref=${data.code}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <p className="text-sm text-red-600">{loadError}</p>
        <button onClick={fetchData} className="mt-4 text-sm font-medium text-orange-600 hover:underline">Tentar novamente</button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Programa de Indicação</h1>
        <p className="mt-1 text-sm text-slate-500">
          Compartilhe seu código e ganhe 20% de comissão sobre cada pagamento de clientes indicados.
        </p>
      </div>

      {/* Code Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Seu Código</h2>

        {!data?.code ? (
          <div className="text-center">
            <p className="mb-4 text-sm text-slate-500">Você ainda não gerou um código de indicação.</p>
            {generateError && (
              <p className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{generateError}</p>
            )}
            <button
              onClick={generateCode}
              disabled={generating}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-50"
            >
              {generating ? 'Gerando...' : 'Gerar Código'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-lg font-bold tracking-wider text-slate-900">
              {data.code}
            </div>
            <button
              onClick={copyCode}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
            >
              {copied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar Link'}
            </button>
          </div>
        )}

        {data?.code && (
          <p className="mt-3 text-xs text-slate-400">
            Compartilhe: <span className="text-slate-600">{typeof window !== 'undefined' ? window.location.origin : ''}/register?ref={data.code}</span>
          </p>
        )}
      </div>

      {/* Wallet Status */}
      <div className={`rounded-2xl border p-6 shadow-sm ${
        data?.wallet_connected
          ? 'border-emerald-200 bg-emerald-50/50'
          : 'border-amber-200 bg-amber-50/50'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            data?.wallet_connected ? 'bg-emerald-100' : 'bg-amber-100'
          }`}>
            {data?.wallet_connected
              ? <Wallet className="h-5 w-5 text-emerald-600" />
              : <AlertTriangle className="h-5 w-5 text-amber-600" />
            }
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {data?.wallet_connected ? 'Carteira Asaas Conectada' : 'Carteira Asaas Pendente'}
            </h3>
            <p className="text-xs text-slate-500">
              {data?.wallet_connected
                ? 'Seus splits são processados automaticamente a cada pagamento.'
                : 'Seus splits serão processados assim que sua carteira for configurada.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Indicados" value={data?.stats.total_referred ?? 0} />
        <StatCard icon={DollarSign} label="Total Comissão" value={currency(data?.stats.total_commission ?? 0)} />
        <StatCard icon={CheckCircle} label="Pago" value={currency(data?.stats.paid_commission ?? 0)} />
        <StatCard icon={Clock} label="Pendente" value={currency(data?.stats.pending_commission ?? 0)} />
      </div>

      {/* Commissions Table */}
      {data?.commissions && data.commissions.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Comissões Recentes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3">Data</th>
                  <th className="px-6 py-3">Valor</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.commissions.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 text-slate-600">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-900">
                      {currency(Number(c.amount))}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        c.status === 'paid' || c.status === 'split'
                          ? 'bg-emerald-50 text-emerald-700'
                          : c.status === 'pending'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                      }`}>
                        {c.status === 'paid' ? 'Pago' : c.status === 'split' ? 'Split' : c.status === 'pending' ? 'Pendente' : 'Cancelado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {data?.commissions && data.commissions.length === 0 && data.code && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            Nenhuma comissão ainda. Compartilhe seu código para começar a indicar!
          </p>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
          <Icon className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className="text-lg font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  )
}
