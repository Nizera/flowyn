'use client'

import { useEffect, useState } from 'react'
import { Copy, Users, DollarSign, Clock, CheckCircle } from 'lucide-react'

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
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/referrals/dashboard')
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error('Failed to load referral data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function generateCode() {
    setGenerating(true)
    try {
      const res = await fetch('/api/referrals/track', { method: 'POST' })
      const json = await res.json()
      if (json.code) {
        setData(prev => prev ? { ...prev, code: json.code } : null)
      }
    } catch (err) {
      console.error('Failed to generate code:', err)
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Programa de Indicação</h1>
        <p className="mt-1 text-sm text-slate-500">
          Compartilhe seu código e ganhe 20% de comissão sobre a primeira venda de cada cliente indicado.
        </p>
      </div>

      {/* Code Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Seu Código</h2>

        {!data?.code ? (
          <div className="text-center">
            <p className="mb-4 text-sm text-slate-500">Você ainda não gerou um código de indicação.</p>
            <button
              onClick={generateCode}
              disabled={generating}
              className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
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
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
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
                        c.status === 'paid'
                          ? 'bg-green-50 text-green-700'
                          : c.status === 'pending'
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-red-50 text-red-700'
                      }`}>
                        {c.status === 'paid' ? 'Pago' : c.status === 'pending' ? 'Pendente' : 'Cancelado'}
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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
          <Icon className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className="text-lg font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  )
}
