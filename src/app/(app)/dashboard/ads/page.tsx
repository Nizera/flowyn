'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type AdAccount = {
  id: string
  ad_account_id: string
  ad_account_name: string | null
  sync_enabled: boolean
  last_sync_at: string | null
  is_active: boolean
  sync_from_date: string | null
  created_at: string | null
}

type Campaign = {
  campaign_id: string
  name: string
  status: string
  effective_status: string | null
  sync_enabled: boolean
  daily_budget: number | null
  lifetime_budget: number | null
  objective: string | null
  stats: {
    spend: number
    clicks: number
    impressions: number
    conversions: number
    conversion_value: number
  }
}

type SyncStatusMap = Record<string, 'idle' | 'syncing' | 'done' | 'error'>

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
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatusMap>({})
  const [syncingAccount, setSyncingAccount] = useState<string | null>(null)
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<Record<string, Campaign[]>>({})
  const [loadingCampaigns, setLoadingCampaigns] = useState<string | null>(null)
  const [togglingCampaign, setTogglingCampaign] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/meta-ads/campaigns?action=accounts')
    const data = await res.json()
    setAccounts(data.accounts || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'connected') {
      window.history.replaceState({}, '', '/dashboard/ads')
    }
  }, [])

  async function handleToggleSync(accountId: string, enabled: boolean) {
    try {
      const res = await fetch('/api/meta-ads/sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_account_id: accountId, sync_enabled: enabled }),
      })
      if (res.ok) {
        setAccounts(prev => prev.map(a => a.ad_account_id === accountId ? { ...a, sync_enabled: enabled } : a))
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Erro ao atualizar sincronizacao')
      }
    } catch {
      alert('Erro ao conectar com o servidor')
    }
  }

  async function handleSync(accountId: string) {
    setSyncingAccount(accountId)
    setSyncStatus(prev => ({ ...prev, [accountId]: 'syncing' }))
    try {
      const res = await fetch('/api/meta-ads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_account_id: accountId }),
      })
      if (res.ok) {
        setSyncStatus(prev => ({ ...prev, [accountId]: 'done' }))
        await fetchAccounts()
        // Reload campaigns if this account is currently expanded
        if (expandedAccount === accountId) {
          setCampaigns(prev => {
            const next = { ...prev }
            delete next[accountId]
            return next
          })
          setLoadingCampaigns(accountId)
          try {
            const listRes = await fetch(`/api/meta-ads/campaigns/list?ad_account_id=${accountId}`)
            if (listRes.ok) {
              const data = await listRes.json()
              setCampaigns(prev => ({ ...prev, [accountId]: data.campaigns || [] }))
            }
          } finally {
            setLoadingCampaigns(null)
          }
        }
      } else {
        setSyncStatus(prev => ({ ...prev, [accountId]: 'error' }))
      }
    } catch {
      setSyncStatus(prev => ({ ...prev, [accountId]: 'error' }))
    } finally {
      setSyncingAccount(null)
      setTimeout(() => setSyncStatus(prev => ({ ...prev, [accountId]: 'idle' })), 3000)
    }
  }

  async function handleDisconnect(accountId: string) {
    if (!confirm('Tem certeza que deseja desconectar esta conta? Os dados serao removidos.')) return
    setDisconnecting(accountId)
    try {
      const res = await fetch('/api/meta-ads/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_account_id: accountId }),
      })
      if (res.ok) {
        setAccounts(prev => prev.filter(a => a.ad_account_id !== accountId))
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Erro ao desconectar')
      }
    } catch {
      alert('Erro ao conectar com o servidor')
    } finally {
      setDisconnecting(null)
    }
  }

  async function toggleExpand(accountId: string) {
    if (expandedAccount === accountId) {
      setExpandedAccount(null)
      return
    }
    setExpandedAccount(accountId)
    if (!campaigns[accountId]) {
      setLoadingCampaigns(accountId)
      try {
        const res = await fetch(`/api/meta-ads/campaigns/list?ad_account_id=${accountId}`)
        if (res.ok) {
          const data = await res.json()
          setCampaigns(prev => ({ ...prev, [accountId]: data.campaigns || [] }))
        }
      } finally {
        setLoadingCampaigns(null)
      }
    }
  }

  async function handleToggleCampaign(campaignId: string, adAccountId: string, enabled: boolean) {
    setTogglingCampaign(campaignId)
    try {
      const res = await fetch('/api/meta-ads/campaigns/sync-toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, ad_account_id: adAccountId, sync_enabled: enabled }),
      })
      if (res.ok) {
        setCampaigns(prev => {
          const next = { ...prev }
          for (const key of Object.keys(next)) {
            next[key] = next[key].map(c =>
              c.campaign_id === campaignId ? { ...c, sync_enabled: enabled } : c
            )
          }
          return next
        })
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Erro ao atualizar campanha')
      }
    } catch {
      alert('Erro ao conectar com o servidor')
    } finally {
      setTogglingCampaign(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {showConnectModal && <ConnectModal onClose={() => setShowConnectModal(false)} />}

      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1600px] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-foreground">Meta Ads</h1>
              <p className="text-sm text-muted">Conecte e gerencie suas contas de anuncios</p>
            </div>
            <div className="flex items-center gap-2">
              {accounts.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Tem certeza que deseja desconectar TODAS as contas Meta?')) return
                    try {
                      const res = await fetch('/api/meta-ads/disconnect-all', { method: 'POST' })
                      if (res.ok) {
                        setAccounts([])
                        setCampaigns({})
                        setExpandedAccount(null)
                      }
                    } catch {}
                  }}
                  className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  Desconectar todas
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowConnectModal(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Conectar conta
              </button>
            </div>
          </div>
        </div>
      </div>

      {accounts.length > 0 && (
        <div className="mx-auto max-w-[1600px] px-6 pt-6">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-semibold">Como funciona</p>
                <p className="mt-1">
                  A Flowyn apenas <strong>le</strong> seus dados do Meta Ads. Nos nao gastamos dinheiro,
                  nao criamos campanhas e nao modificamos suas configuracoes sem sua autorizacao.
                  Os dados sao usados apenas para exibir metricas no dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-muted">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Carregando contas...
            </div>
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState onConnect={() => setShowConnectModal(true)} />
        ) : (
          <div className="w-full">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-card">
                <tr className="text-left text-xs uppercase text-muted">
                  <th className="px-4 py-3">Conta</th>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3 text-center">Sincronizacao</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Dados desde</th>
                  <th className="px-4 py-3">Ultimo sync</th>
                  <th className="px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(acc => (
                  <CampaignRow
                    key={acc.id}
                    acc={acc}
                    expanded={expandedAccount === acc.ad_account_id}
                    onExpand={toggleExpand}
                    campaigns={campaigns[acc.ad_account_id] || null}
                    loadingCampaigns={loadingCampaigns === acc.ad_account_id}
                    togglingCampaign={togglingCampaign}
                    onToggleCampaign={handleToggleCampaign}
                    syncStatus={syncStatus}
                    syncingAccount={syncingAccount}
                    onSync={handleSync}
                    onToggleSync={handleToggleSync}
                    onDisconnect={handleDisconnect}
                    disconnecting={disconnecting}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function CampaignRow({
  acc, expanded, onExpand, campaigns, loadingCampaigns, togglingCampaign,
  onToggleCampaign, syncStatus, syncingAccount, onSync, onToggleSync,
  onDisconnect, disconnecting,
}: {
  acc: AdAccount
  expanded: boolean
  onExpand: (id: string) => void
  campaigns: Campaign[] | null
  loadingCampaigns: boolean
  togglingCampaign: string | null
  onToggleCampaign: (id: string, adAccountId: string, enabled: boolean) => void
  syncStatus: SyncStatusMap
  syncingAccount: string | null
  onSync: (id: string) => void
  onToggleSync: (id: string, enabled: boolean) => void
  onDisconnect: (id: string) => void
  disconnecting: string | null
}) {
  return (
    <>
      <tr className="border-t border-border bg-card transition hover:bg-surface">
        <td className="px-4 py-4">
          <button
            type="button"
            onClick={() => onExpand(acc.ad_account_id)}
            className="flex items-center gap-2 group"
          >
            <svg className={`h-4 w-4 text-muted transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <div className="font-semibold text-foreground group-hover:text-blue-600 transition">{acc.ad_account_name || 'Sem nome'}</div>
          </button>
        </td>
        <td className="px-4 py-4">
          <span className="font-mono text-xs text-muted">{acc.ad_account_id}</span>
        </td>
        <td className="px-4 py-4 text-center">
          <button
            type="button"
            onClick={() => onToggleSync(acc.ad_account_id, !acc.sync_enabled)}
            className="focus:outline-none"
          >
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              acc.sync_enabled ? 'bg-emerald-500/15 text-emerald-500' : 'bg-surface text-muted'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${acc.sync_enabled ? 'bg-emerald-500' : 'bg-muted'}`} />
              {acc.sync_enabled ? 'Ativa' : 'Inativa'}
            </span>
          </button>
        </td>
        <td className="px-4 py-4 text-center">
          {syncingAccount === acc.ad_account_id ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-blue-600">
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sincronizando...
            </span>
          ) : syncStatus[acc.ad_account_id] === 'done' ? (
            <span className="text-xs text-emerald-600">Sincronizado</span>
          ) : syncStatus[acc.ad_account_id] === 'error' ? (
            <span className="text-xs text-red-600">Erro</span>
          ) : null}
        </td>
        <td className="px-4 py-4">
          <span className="text-sm text-muted">
            {acc.sync_from_date ? new Date(acc.sync_from_date + 'T00:00:00').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : acc.created_at ? new Date(acc.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'}
          </span>
        </td>
        <td className="px-4 py-4">
          <span className="text-sm text-muted">
            {acc.last_sync_at ? `${formatTimeAgo(acc.last_sync_at)} atras` : 'Nunca'}
          </span>
        </td>
        <td className="px-4 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {acc.sync_enabled && (
              <button
                type="button"
                onClick={() => onSync(acc.ad_account_id)}
                disabled={syncingAccount === acc.ad_account_id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-surface disabled:opacity-50"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sincronizar
              </button>
            )}
            <Link href={`/dashboard/ads/${acc.ad_account_id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => onDisconnect(acc.ad_account_id)}
              disabled={disconnecting === acc.ad_account_id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-card px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
            >
              {disconnecting === acc.ad_account_id ? (
                <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              )}
              Desconectar
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-surface/50 px-4 py-0">
            {loadingCampaigns ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Carregando campanhas...
              </div>
            ) : !campaigns || campaigns.length === 0 ? (
              <div className="py-4 text-sm text-muted">Nenhuma campanha encontrada nesta conta.</div>
            ) : (
              <div className="py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted">{campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}</span>
                  <span className="text-xs text-muted">
                    {campaigns.filter(c => c.sync_enabled).length} sincronizando
                  </span>
                </div>
                <div className="space-y-1">
                  {campaigns.map(c => (
                    <div key={c.campaign_id} className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${
                      c.sync_enabled ? 'bg-card' : 'bg-card/50 opacity-60'
                    }`}>
                      <button
                        type="button"
                        onClick={() => onToggleCampaign(c.campaign_id, acc.ad_account_id, !c.sync_enabled)}
                        disabled={togglingCampaign === c.campaign_id}
                        className="focus:outline-none disabled:opacity-50"
                      >
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded border transition ${
                          c.sync_enabled
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-border bg-background text-transparent'
                        }`}>
                          {c.sync_enabled && (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${c.sync_enabled ? 'text-foreground' : 'text-muted'}`}>{c.name}</span>
                          <StatusBadge status={c.effective_status || c.status} />
                          {c.objective && (
                            <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted">{c.objective}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted">
                        {c.stats.spend > 0 && (
                          <span>Gasto: <strong className="text-foreground">R$ {c.stats.spend.toFixed(2)}</strong></span>
                        )}
                        {c.stats.clicks > 0 && (
                          <span>{c.stats.clicks.toLocaleString()} cliques</span>
                        )}
                        {c.stats.conversions > 0 && (
                          <span className="text-emerald-600">{c.stats.conversions} conversoes</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/15 text-emerald-500',
    PAUSED: 'bg-amber-500/15 text-amber-500',
    ARCHIVED: 'bg-surface text-muted',
    DELETED: 'bg-red-500/15 text-red-500',
  }
  const label: Record<string, string> = {
    ACTIVE: 'Ativa',
    PAUSED: 'Pausada',
    ARCHIVED: 'Arquivada',
    DELETED: 'Deletada',
  }
  const color = colors[status] || 'bg-surface text-muted'
  const text = label[status] || status
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>{text}</span>
  )
}

function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
        <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-foreground">Nenhuma conta conectada</p>
      <p className="mt-1 max-w-sm text-center text-xs leading-5 text-muted">
        Conecte sua conta de anuncios do Meta para visualizar metricas e configurar UTM tracking.
      </p>
      <button
        type="button"
        onClick={onConnect}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        + Conectar conta
      </button>
    </div>
  )
}

function ConnectModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'info' | 'confirm'>('info')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', handleKey) }
  }, [onClose])

  function handleConnect() {
    if (step === 'info') {
      setStep('confirm')
    } else {
      window.location.href = '/api/meta-ads/connect'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        {step === 'info' ? (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Conectar Meta Ads</h2>

            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">1</span>
                <p>A Flowyn <strong>somente le</strong> seus dados do Meta Ads (campanhas, metricas, gastos).</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">2</span>
                <p><strong>Nao gastamos dinheiro</strong> e nao criamos campanhas sem sua autorizacao.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">3</span>
                <p>Voce pode <strong>desconectar a qualquer momento</strong> e todos os dados serao removidos.</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">O que voce pode fazer</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Feature icon="📊" text="Dashboard com metricas em tempo real" />
                <Feature icon="💰" text="Alterar orcamentos de campanhas" />
                <Feature icon="⏸️" text="Pausar ou retomar campanhas" />
                <Feature icon="📋" text="Criar regras automatizadas" />
                <Feature icon="🔄" text="Duplicar campanhas entre contas" />
                <Feature icon="📈" text="ROAS real por campanha" />
                <Feature icon="🎯" text="Atribuicao de vendas por anuncio" />
                <Feature icon="⚡" text="Regras: pausar se CPA alto" />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
              <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Tem certeza?</h2>
            <p className="mt-2 text-sm text-gray-600">
              Ao conectar, a Flowyn tera acesso para <strong>ler e gerenciar</strong> suas contas de anuncios.
            </p>
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Ler campanhas, conjuntos e anuncios
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Alterar orcamentos (com sua autorizacao)
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Pausar/retomar campanhas (com sua autorizacao)
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Criar regras automatizadas
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <strong>Importante:</strong> Nenhuma alteracao sera feita sem sua autorizacao. Regras automatizadas pedem confirmacao antes de executar.
            </div>
          </>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConnect}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {step === 'info' ? 'Entendi, conectar' : 'Conectar agora'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-gray-700 ring-1 ring-gray-200">
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  )
}
