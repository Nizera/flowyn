'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type AdAccount = {
  id: string
  ad_account_id: string
  ad_account_name: string | null
  sync_enabled: boolean
  last_sync_at: string | null
}

function formatTimeAgo(dateStr: string | null) {
  if (!dateStr) return 'Nunca'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diff < 60) return `${diff}min`
  const hours = Math.floor(diff / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export default function AdsAccountsPage() {
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchAccounts() {
    const res = await fetch('/api/meta-ads/campaigns?action=accounts')
    const data = await res.json()
    setAccounts(data.accounts || [])
    setLoading(false)
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchAccounts()
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleToggleSync(accountId: string, enabled: boolean) {
    await fetch('/api/meta-ads/sync', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad_account_id: accountId, sync_enabled: enabled }),
    })
    setAccounts(prev => prev.map(a => a.ad_account_id === accountId ? { ...a, sync_enabled: enabled } : a))
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Contas Meta Ads</h1>
              <p className="text-sm text-slate-500">Gerencie suas contas de anuncios conectadas</p>
            </div>
            <a href="/api/meta-ads/connect"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Conectar conta
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-slate-500">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Carregando contas...
            </div>
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <svg className="mb-3 h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="text-sm">Nenhuma conta conectada</p>
            <p className="mt-1 text-xs">Conecte sua conta de anuncios do Meta para comecar</p>
            <a href="/api/meta-ads/connect"
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              + Conectar conta
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto light-scrollbar">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white">
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="min-w-[300px] px-4 py-3">Conta</th>
                  <th className="w-32 px-4 py-3">ID</th>
                  <th className="w-40 px-4 py-3 text-center">Sincronizacao</th>
                  <th className="w-40 px-4 py-3">Ultimo sync</th>
                  <th className="w-48 px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(acc => (
                  <tr key={acc.id} className="border-t border-slate-100 bg-white transition hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{acc.ad_account_name || 'Sem nome'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-mono text-xs text-slate-400">{acc.ad_account_id}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleSync(acc.ad_account_id, !acc.sync_enabled)}
                        className="focus:outline-none"
                      >
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          acc.sync_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${acc.sync_enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {acc.sync_enabled ? 'Ativa' : 'Inativa'}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-slate-600">
                        {acc.last_sync_at ? `${formatTimeAgo(acc.last_sync_at)} atras` : <span className="text-slate-400">Nunca</span>}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link href={`/dashboard/ads/${acc.ad_account_id}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Gerenciar campanhas
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
