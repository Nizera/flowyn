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
  return `${Math.floor(diff / 60)}h`
}

export default function AdsAccountsPage() {
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  useEffect(() => {
    fetchAccounts()
  }, [])

  async function fetchAccounts() {
    const res = await fetch('/api/meta-ads/campaigns?action=accounts')
    const data = await res.json()
    setAccounts(data.accounts || [])
    setLoading(false)
  }

  async function handleSync(accountId: string) {
    setSyncingId(accountId)
    const res = await fetch('/api/meta-ads/sync-expanded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_account_id: accountId }),
    })
    const json = await res.json()
    if (json.error) alert(`Erro: ${json.error}`)
    else alert('Sincronização concluída!')
    setSyncingId(null)
    fetchAccounts()
  }

  async function handleToggleSync(accountId: string, enabled: boolean) {
    await fetch('/api/meta-ads/sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_account_id: accountId, sync_enabled: enabled }),
    })
    setAccounts(prev => prev.map(a => a.ad_account_id === accountId ? { ...a, sync_enabled: enabled } : a))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-950">Contas Meta Ads</h1>
        <a href="/api/meta-ads/connect" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700">
          + Conectar conta
        </a>
      </div>

      {loading ? <div>Carregando...</div> : (
        <div className="grid gap-4">
          {accounts.map(acc => (
            <div key={acc.id} className="rounded-2xl border border-slate-200 bg-white p-6 flex justify-between items-center">
              <div>
                <p className="font-bold">{acc.ad_account_name || acc.ad_account_id}</p>
                <p className="text-xs text-slate-400">Último sync: {formatTimeAgo(acc.last_sync_at)}</p>
              </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-bold text-slate-500">Auto-sync</span>
                    <button type="button" onClick={() => handleToggleSync(acc.ad_account_id, !acc.sync_enabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${acc.sync_enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${acc.sync_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </label>
                  <Link href={`/dashboard/ads/${acc.ad_account_id}`} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">
                    Gerenciar campanhas
                  </Link>
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
