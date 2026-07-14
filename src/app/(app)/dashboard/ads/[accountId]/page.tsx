'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type TabType = 'campaigns' | 'adsets' | 'ads'

function formatBRL(value: any) {
  const num = parseFloat(value) || 0
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatNumber(value: any) {
  const num = parseInt(value, 10) || 0
  return num.toLocaleString('pt-BR')
}

export default function CampaignManagementPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const accountId = params.accountId as string

  const [tab, setTab] = useState<TabType>('campaigns')
  const [data, setData] = useState<any>({ campaigns: [], ad_sets: [], ads: [] })
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/meta-ads/campaigns/db?ad_account_id=${accountId}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabType
    if (tabParam) setTab(tabParam)
    fetchData()
  }, [fetchData, searchParams])

  const Tabs = [
    { key: 'campaigns', label: 'Campanhas', data: data.campaigns },
    { key: 'adsets', label: 'Conjuntos', data: data.ad_sets },
    { key: 'ads', label: 'Anúncios', data: data.ads },
  ] as const

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ads" className="text-slate-400">Voltar</Link>
        <h1 className="text-2xl font-black">Gestão: {accountId}</h1>
      </div>

      <div className="flex gap-2 border-b">
        {Tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); router.push(`?tab=${t.key}`) }}
            className={`px-4 py-2 font-bold ${tab === t.key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}>
            {t.label} ({t.data.length})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="text-left text-slate-500 uppercase text-xs">
              <th className="p-3">Nome</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Gasto</th>
              <th className="p-3 text-right">Impressões</th>
              <th className="p-3 text-right">Cliques</th>
              <th className="p-3 text-right">CTR</th>
              <th className="p-3 text-right">CPC</th>
            </tr>
          </thead>
          <tbody>
            {data[tab === 'campaigns' ? 'campaigns' : tab === 'adsets' ? 'ad_sets' : 'ads'].map((item: any) => (
              <tr key={item.campaign_id || item.ad_set_id || item.ad_id} className="border-t">
                <td className="p-3 font-bold">{item.name}</td>
                <td className="p-3">{item.status}</td>
                <td className="p-3 text-right">{formatBRL(item.insights?.spend || 0)}</td>
                <td className="p-3 text-right">{formatNumber(item.insights?.impressions || 0)}</td>
                <td className="p-3 text-right">{formatNumber(item.insights?.clicks || 0)}</td>
                <td className="p-3 text-right">{(parseFloat(item.insights?.ctr) || 0).toFixed(2)}%</td>
                <td className="p-3 text-right">{formatBRL(parseFloat(item.insights?.cpc) || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
