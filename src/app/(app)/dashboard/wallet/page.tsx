'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Clock, ExternalLink, Wallet } from 'lucide-react'

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err) || 'Erro de conexao.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => fetchBalance())
  }, [])

  function handleOpenDashboard() {
    setDashboardLoading(true)
    window.open('https://www.asaas.com', '_blank')
    setDashboardLoading(false)
  }

  return (
    <section className="overflow-hidden rounded-[10px] bg-card px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Carteira</h2>
          <p className="mt-2 text-sm text-muted">Gerencie saldo e recebiveis atraves da Asaas.</p>
        </div>
        <button
          onClick={handleOpenDashboard}
          disabled={dashboardLoading || loading || balance === null}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ExternalLink className="h-4 w-4" />
          Abrir Asaas
        </button>
      </div>

      {error && (
        <div className="mt-8 flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="mt-10 border-y border-border">
        <RowTitle title="Saldos" description="Valores informados pela conta conectada." />
        <div className="grid gap-8 py-6 md:grid-cols-2">
          <Balance label="Saldo disponivel" icon={<Wallet className="h-5 w-5" />} value={loading ? null : balance?.available || 0} />
          <Balance label="Saldo pendente" icon={<Clock className="h-5 w-5" />} value={loading ? null : balance?.pending || 0} muted />
        </div>
      </div>

      <div className="border-b border-border">
        <RowTitle title="Saques" description="Operacao feita no painel Asaas." />
        <div className="py-6">
          <p className="max-w-2xl text-sm leading-6 text-muted">
            A Flowyn utiliza subcontas Asaas para receber vendas no checkout. O saldo, a conta bancaria, a chave Pix e as transferencias sao administrados diretamente no painel Asaas do usuario.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            O prazo de compensacao depende do metodo de pagamento e das regras da conta Asaas conectada.
          </p>
        </div>
      </div>
    </section>
  )
}

function Balance({ label, icon, value, muted = false }: { label: string; icon: React.ReactNode; value: number | null; muted?: boolean }) {
  return (
    <div>
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${muted ? 'bg-amber-50 text-amber-700' : 'bg-orange-50 text-orange-600'}`}>
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      {value === null ? (
        <div className="mt-3 h-8 w-40 animate-pulse rounded-lg bg-surface" />
      ) : (
        <p className="mt-2 text-3xl font-semibold text-foreground">{currency(value)}</p>
      )}
    </div>
  )
}

function RowTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="pt-6">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  )
}
