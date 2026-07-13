'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type AdAccount = {
  id: string
  ad_account_id: string
  ad_account_name: string | null
  pixel_id: string | null
  sync_enabled: boolean
  last_sync_at: string | null
  created_at: string
}

type ApiUsage = {
  current_usage: number
  max_calls: number
  remaining: number
  reset_at: string
}

function formatTimeAgo(dateStr: string | null) {
  if (!dateStr) return 'Nunca sincronizado'
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Agora mesmo'
  if (diffMin < 60) return `Há ${diffMin} min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `Há ${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  return `Há ${diffDays}d`
}

function formatResetTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function AdsPage() {
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [apiUsage, setApiUsage] = useState<ApiUsage | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    fetchAccounts()
    fetchApiUsage()
  }, [])

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/meta-ads/campaigns?action=accounts')
      const data = await res.json()
      setAccounts(data.accounts || [])
    } catch {
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchApiUsage() {
    try {
      const res = await fetch('/api/meta-ads/sync')
      const data = await res.json()
      setApiUsage(data)
    } catch {
      // Ignore
    }
  }

  async function handleSync(accountId: string) {
    setSyncingId(accountId)
    setSyncError(null)
    try {
      const res = await fetch('/api/meta-ads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_account_id: accountId }),
      })
      const data = await res.json()

      if (res.status === 429) {
        setSyncError(`Limite de API atingido. Reseta às ${formatResetTime(data.reset_at)}`)
      } else if (data.error) {
        setSyncError(data.error)
      } else {
        // Update usage from response
        if (data.api_usage) {
          setApiUsage({
            current_usage: data.api_usage.current,
            max_calls: data.api_usage.max,
            remaining: data.api_usage.remaining,
            reset_at: data.api_usage.reset_at,
          })
        }
        fetchAccounts()
      }
    } catch (err) {
      setSyncError('Erro ao sincronizar')
    } finally {
      setSyncingId(null)
    }
  }

  async function handleToggleSync(accountId: string, enabled: boolean) {
    try {
      await fetch('/api/meta-ads/sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_account_id: accountId, sync_enabled: enabled }),
      })
      setAccounts(prev =>
        prev.map(a =>
          a.ad_account_id === accountId ? { ...a, sync_enabled: enabled } : a
        )
      )
    } catch (err) {
      console.error('Toggle failed:', err)
    }
  }

  const isRateLimited = apiUsage ? apiUsage.remaining <= 0 : false

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">Meta Ads</h1>
          <p className="mt-1 text-sm text-slate-500">
            Conecte suas contas de anúncio para gerenciar campanhas e acompanhar métricas.
          </p>
        </div>
        <a
          href="/api/meta-ads/connect"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-blue-700"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Conectar conta Meta
        </a>
      </div>

      {/* API Usage Indicator */}
      {apiUsage && (
        <div className={`rounded-2xl border p-4 ${isRateLimited ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isRateLimited ? 'bg-amber-100' : 'bg-blue-50'}`}>
                <svg className={`h-5 w-5 ${isRateLimited ? 'text-amber-600' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Uso da API Meta: {apiUsage.current_usage} / {apiUsage.max_calls}
                </p>
                <p className="text-xs text-slate-500">
                  {isRateLimited
                    ? `Limite atingido. Reseta às ${formatResetTime(apiUsage.reset_at)}`
                    : `${apiUsage.remaining} chamadas restantes nesta hora`
                  }
                </p>
              </div>
            </div>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all ${
                  isRateLimited ? 'bg-amber-500' : apiUsage.current_usage > 150 ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (apiUsage.current_usage / apiUsage.max_calls) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Sync Error */}
      {syncError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">{syncError}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : accounts.length > 0 ? (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900">
                    {account.ad_account_name || `Conta ${account.ad_account_id}`}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    ID: {account.ad_account_id}
                  </p>
                  {account.pixel_id && (
                    <p className="mt-1 text-xs text-slate-400">
                      Pixel: {account.pixel_id}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    Último sync: {formatTimeAgo(account.last_sync_at)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Sync toggle */}
                  <label className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Auto-sync</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSync(account.ad_account_id, !account.sync_enabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        account.sync_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          account.sync_enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </label>

                  {/* Manual sync button */}
                  <button
                    onClick={() => handleSync(account.ad_account_id)}
                    disabled={syncingId === account.ad_account_id || isRateLimited}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title={isRateLimited ? 'Limite de API atingido' : ''}
                  >
                    {syncingId === account.ad_account_id ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                        Sincronizando...
                      </span>
                    ) : (
                      'Sincronizar agora'
                    )}
                  </button>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Conectado
                  </span>

                  <Link
                    href={`/dashboard/ads/${account.ad_account_id}`}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    Ver campanhas
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
            <svg className="h-8 w-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">Nenhuma conta conectada</h3>
          <p className="mt-2 text-sm text-slate-500">
            Conecte sua conta do Meta Ads para gerenciar campanhas e acompanhar métricas diretamente na Flowyn.
          </p>
          <a
            href="/api/meta-ads/connect"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Conectar conta Meta Ads
          </a>
        </div>
      )}
    </div>
  )
}
