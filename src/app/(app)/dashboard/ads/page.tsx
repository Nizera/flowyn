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

  useEffect(() => {
    fetch('/api/meta-ads/campaigns?action=accounts')
      .then(res => res.json())
      .then(data => setAccounts(data.accounts || []))
      .finally(() => setLoading(false))
  }, [])

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
              <Link href={`/dashboard/ads/${acc.ad_account_id}`} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200">
                Gerenciar campanhas
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
