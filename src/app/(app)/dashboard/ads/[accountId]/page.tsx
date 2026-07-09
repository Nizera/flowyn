'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Campaign = {
  id: string
  name: string
  status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  created_time: string
  insights?: {
    impressions: string
    clicks: string
    spend: string
    ctr: string
    cpc: string
    cpm: string
    actions?: { action_type: string; value: string }[]
  } | null
}

function formatCurrency(value: string) {
  const cents = parseInt(value, 10)
  if (isNaN(cents)) return 'R$ 0,00'
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

function formatNumber(value: string) {
  const num = parseInt(value, 10)
  if (isNaN(num)) return '0'
  return num.toLocaleString('pt-BR')
}

function getStatusColor(status: string) {
  switch (status) {
    case 'ACTIVE': return 'bg-emerald-50 text-emerald-700'
    case 'PAUSED': return 'bg-amber-50 text-amber-700'
    case 'DELETED': return 'bg-red-50 text-red-700'
    default: return 'bg-slate-50 text-slate-700'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'ACTIVE': return 'Ativa'
    case 'PAUSED': return 'Pausada'
    case 'DELETED': return 'Excluída'
    default: return status
  }
}

export default function CampaignListPage() {
  const params = useParams()
  const accountId = params.accountId as string
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/meta-ads/campaigns?ad_account_id=${accountId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setCampaigns(data.campaigns || [])
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [accountId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">{error}</p>
        <Link href="/dashboard/ads" className="mt-4 inline-block text-sm font-bold text-blue-600 hover:underline">
          Voltar
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ads" className="text-slate-400 hover:text-slate-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-950">Campanhas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Conta: {accountId} • {campaigns.length} campanhas
          </p>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-sm text-slate-500">Nenhuma campanha encontrada nesta conta.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Campanha
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  Impressões
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  Cliques
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  Gasto
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  CTR
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  CPC
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="transition hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-slate-900">{campaign.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{campaign.objective}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${getStatusColor(campaign.status)}`}>
                      {getStatusLabel(campaign.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-700">
                    {formatNumber(campaign.insights?.impressions || '0')}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-700">
                    {formatNumber(campaign.insights?.clicks || '0')}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(campaign.insights?.spend || '0')}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-700">
                    {campaign.insights?.ctr ? `${parseFloat(campaign.insights.ctr).toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-700">
                    {campaign.insights?.cpc ? `R$ ${parseFloat(campaign.insights.cpc).toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}