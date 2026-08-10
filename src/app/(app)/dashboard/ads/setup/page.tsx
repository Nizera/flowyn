'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type AdAccount = {
  account_id: string
  name: string
}

type ExistingAccount = {
  ad_account_id: string
  ad_account_name: string | null
  sync_enabled: boolean
}

export default function MetaSetupPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [existingAccounts, setExistingAccounts] = useState<ExistingAccount[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/meta-ads/setup/accounts')
      if (!res.ok) {
        setError('Erro ao carregar contas')
        return
      }
      const data = await res.json()
      setAccounts(data.accounts || [])
      setExistingAccounts(data.existing || [])
      
      const preSelected = new Set<string>()
      for (const acc of data.accounts || []) {
        const exists = (data.existing || []).find((e: ExistingAccount) => e.ad_account_id === acc.account_id)
        if (!exists) {
          preSelected.add(acc.account_id)
        }
      }
      setSelected(preSelected)
    } catch {
      setError('Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  function toggleAccount(accountId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
      }
      return next
    })
  }

  function toggleAll() {
    if (selected.size === accounts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(accounts.map(a => a.account_id)))
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/meta-ads/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accounts: accounts.map(a => ({
            account_id: a.account_id,
            name: a.name,
            sync_enabled: selected.has(a.account_id),
          })),
        }),
      })
      if (res.ok) {
        router.push('/dashboard/ads')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Erro ao salvar configuracao')
      }
    } catch {
      setError('Erro ao conectar com o servidor')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Carregando suas contas...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-foreground">Configurar Meta Ads</h1>
          <p className="text-sm text-muted">Escolha quais contas de anuncios deseja acompanhar</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-semibold">Escolha sabiamente</p>
              <p className="mt-1">
                Apenas as contas que voce selecionar terao seus dados sincronizados.
                Os ultimos 90 dias de dados serao importados. Voce pode ativar/desativar campanhas individuais depois.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Contas de anuncios encontradas</h2>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              {selected.size === accounts.length ? 'Desmarcar todas' : 'Marcar todas'}
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted">
              <p className="text-sm">Nenhuma conta de anuncios encontrada nesta conta do Meta.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(acc => {
                const exists = existingAccounts.find(e => e.ad_account_id === acc.account_id)
                const isSelected = selected.has(acc.account_id)
                return (
                  <label
                    key={acc.account_id}
                    className={`flex items-center gap-4 rounded-xl border bg-card p-4 cursor-pointer transition hover:bg-surface ${
                      isSelected ? 'border-blue-300 ring-1 ring-blue-200' : 'border-border'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAccount(acc.account_id)}
                      className="h-4 w-4 rounded text-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{acc.name}</span>
                        {exists && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            Ja conectada
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs text-muted">{acc.account_id}</span>
                    </div>
                    {exists?.sync_enabled && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Sincronizando
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/ads')}
            className="flex-1 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface"
          >
            Pular por agora
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || selected.size === 0}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Salvando...' : `Confirmar (${selected.size} conta${selected.size !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  )
}
