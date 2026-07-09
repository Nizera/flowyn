'use client'

import React, { useState } from 'react'

export function MetaAdTestingPanel() {
  const [permissionStatus, setPermissionStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [permissionLogs, setPermissionLogs] = useState<string[]>([])

  const [turboStatus, setTurboStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle')
  const [turboProgress, setTurboProgress] = useState(0)
  const [turboCalls, setTurboCalls] = useState(0)
  const [turboLogs, setTurboLogs] = useState<string[]>([])

  // 1. Run individual permission tests (1 de 1 chamada)
  const runPermissionTests = async () => {
    setPermissionStatus('running')
    setPermissionLogs(['Iniciando testes de permissões...'])

    try {
      const res = await fetch('/api/meta-ads/run-permission-tests')
      const data = await res.json()

      if (data.success) {
        setPermissionStatus('success')
        const logs: string[] = ['Testes de permissões executados com sucesso!']
        
        Object.keys(data.results).forEach((key) => {
          const result = data.results[key]
          
          // Verifica erro detalhado da API da Meta
          const errorMessage = result?.error?.message || 
                               result?.error || 
                               (result && typeof result === 'object' && result.info ? result.info : JSON.stringify(result))
          
          if (result && !result.error && !result.info) {
            logs.push(`✅ Permissão '${key}' testada com sucesso.`)
          } else if (result && result.info) {
            logs.push(`⚠️ Permissão '${key}': ${result.info}`)
          } else {
            logs.push(`❌ Permissão '${key}' falhou: ${errorMessage}`)
          }
        })

        setPermissionLogs(logs)
      } else {
        setPermissionStatus('error')
        setPermissionLogs([`Erro: ${data.error}`])
      }
    } catch (err: any) {
      setPermissionStatus('error')
      setPermissionLogs([`Erro de rede: ${err.message}`])
    }
  }

  // 2. Run Turbo Traffic loop to generate 500 calls (Solução 1 - Turbo Local)
  const runTurboTraffic = async () => {
    if (turboStatus === 'running') return

    setTurboStatus('running')
    setTurboProgress(0)
    setTurboCalls(0)
    setTurboLogs(['Iniciando Turbo Loop para gerar 500 chamadas...'])

    const TOTAL_RUNS = 15
    let callsCount = 0

    for (let i = 1; i <= TOTAL_RUNS; i++) {
      setTurboLogs(prev => [...prev, `[Rodada ${i}/${TOTAL_RUNS}] Sincronizando contas...`])
      
      try {
        const res = await fetch('/api/cron/meta-sync?bypass=true')
        const data = await res.json()

        if (data.success) {
          callsCount += data.api_calls_made
          setTurboCalls(callsCount)
          setTurboLogs(prev => [
            ...prev,
            `✨ Rodada ${i} concluída. +${data.api_calls_made} chamadas registradas (Total: ${callsCount}).`
          ])
        } else {
          setTurboLogs(prev => [...prev, `⚠️ Falha na rodada ${i}: ${data.error}`])
        }
      } catch (err: any) {
        setTurboLogs(prev => [...prev, `⚠️ Erro de rede na rodada ${i}: ${err.message}`])
      }

      const progress = Math.round((i / TOTAL_RUNS) * 100)
      setTurboProgress(progress)

      // Sleep 5 seconds between runs to prevent Rate Limit
      if (i < TOTAL_RUNS) {
        setTurboLogs(prev => [...prev, 'Aguardando 5 segundos para a próxima rodada...'])
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }

    setTurboStatus('completed')
    setTurboLogs(prev => [
      ...prev,
      '🎉 Turbo Loop concluído com sucesso!',
      `Total de chamadas reais feitas: ${callsCount}`,
      'Lembre-se: o painel da Meta pode levar até 24 horas para computar os dados e marcar tudo como Verde.'
    ])
  }

  return (
    <div className="mt-12 rounded-2xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </span>
        <div>
          <h2 className="text-lg font-black text-slate-900">Painel de Testes & Homologação Meta (Exclusivo)</h2>
          <p className="text-sm text-slate-500">
            Use estas ferramentas para bater todos os requisitos do checklist da Meta em tempo recorde.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* 1. Individual Permission Tests */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Passo 1: Teste de Permissões (0 de 1 chamada)</h3>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Este botão faz uma chamada real de teste para cada uma das permissões exigidas no seu checklist da Meta (perfil, e-mail, páginas, negócios, anúncios). Isso vai zerar as pendências individuais instantaneamente.
          </p>

          <button
            onClick={runPermissionTests}
            disabled={permissionStatus === 'running'}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-orange-600 disabled:bg-orange-300"
          >
            {permissionStatus === 'running' ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Executando Testes...
              </span>
            ) : 'Executar Testes de Permissão'}
          </button>

          {permissionLogs.length > 0 && (
            <div className="mt-4 max-h-40 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3 text-[10px] font-mono text-slate-600 space-y-1">
              {permissionLogs.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Turbo Traffic Generator */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Passo 2: Gerador Turbo de Chamadas (0 de 500)</h3>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Em vez de esperar dias, este Turbo Loop faz 15 sincronizações seguidas com segurança. Cada sincronização busca insights de múltiplas campanhas das suas 6 contas conectadas, totalizando mais de 500 chamadas em menos de 5 minutos!
          </p>

          <button
            onClick={runTurboTraffic}
            disabled={turboStatus === 'running'}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 disabled:bg-blue-300"
          >
            {turboStatus === 'running' ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Gerando Chamadas ({turboProgress}%)
              </span>
            ) : turboStatus === 'completed' ? 'Refazer Gerador Turbo' : 'Gerar 500 Chamadas Instantaneamente'}
          </button>

          {turboStatus === 'running' && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Progresso das Rodadas</span>
                <span>{turboProgress}% ({turboCalls} chamadas)</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${turboProgress}%` }}
                />
              </div>
            </div>
          )}

          {turboLogs.length > 0 && (
            <div className="mt-4 max-h-40 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3 text-[10px] font-mono text-slate-600 space-y-1">
              {turboLogs.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
