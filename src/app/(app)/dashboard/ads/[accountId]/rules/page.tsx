'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  entity_level: string
  entity_ids: string[]
  condition_metric: string
  condition_operator: string
  condition_value: number
  condition_period: number
  action_type: string
  action_value: number | null
  action_value_type: string
  last_triggered_at: string | null
  trigger_count: number
  cooldown_hours: number
  notify_whatsapp: boolean
  notify_email: boolean
  webhook_url: string | null
  webhook_secret: string | null
  created_at: string
}

interface ConditionMet {
  metric: string
  operator: string
  threshold: number
  actual_value: number
  period_hours: number
}

interface RuleLog {
  id: string
  rule_id: string
  entity_level: string
  entity_id: string
  entity_name: string
  condition_met: ConditionMet | null
  action_taken: string
  action_result: string
  action_error: string | null
  created_at: string
}

const METRICS = [
  { value: 'roas', label: 'ROAS' },
  { value: 'spend', label: 'Gasto' },
  { value: 'cpa', label: 'CPA' },
  { value: 'ctr', label: 'CTR' },
  { value: 'cpc', label: 'CPC' },
  { value: 'conversions', label: 'Conversoes' },
  { value: 'purchase_value', label: 'Valor de Vendas' },
  { value: 'impressions', label: 'Impressoes' },
  { value: 'cpm', label: 'CPM' },
]

const OPERATORS = [
  { value: 'lt', label: 'menor que' },
  { value: 'lte', label: 'menor ou igual a' },
  { value: 'gt', label: 'maior que' },
  { value: 'gte', label: 'maior ou igual a' },
  { value: 'eq', label: 'igual a' },
]

const ACTIONS = [
  { value: 'pause', label: 'Pausar', levels: ['campaign', 'adset', 'ad'] },
  { value: 'resume', label: 'Retomar', levels: ['campaign', 'adset', 'ad'] },
  { value: 'increase_budget', label: 'Aumentar orcamento', levels: ['campaign', 'adset'] },
  { value: 'decrease_budget', label: 'Diminuir orcamento', levels: ['campaign', 'adset'] },
  { value: 'notify', label: 'Apenas notificar', levels: ['campaign', 'adset', 'ad'] },
]

const ENTITY_LEVELS = [
  { value: 'campaign', label: 'Campanha' },
  { value: 'adset', label: 'Conjunto de anuncio' },
  { value: 'ad', label: 'Anuncio' },
]

const PERIODS = [
  { value: 6, label: 'Ultimas 6 horas' },
  { value: 12, label: 'Ultimas 12 horas' },
  { value: 24, label: 'Ultimas 24 horas' },
  { value: 48, label: 'Ultimas 48 horas' },
  { value: 72, label: 'Ultimos 3 dias' },
  { value: 168, label: 'Ultimos 7 dias' },
]

interface FormData {
  name: string
  entity_level: string
  entity_ids: string[]
  condition_metric: string
  condition_operator: string
  condition_value: string
  condition_period: number
  action_type: string
  action_value: string
  action_value_type: string
  cooldown_hours: number
  notify_whatsapp: boolean
  notify_email: boolean
  webhook_url: string
  webhook_secret: string
}

const defaultForm: FormData = {
  name: '',
  entity_level: 'campaign',
  entity_ids: [],
  condition_metric: 'roas',
  condition_operator: 'lt',
  condition_value: '',
  condition_period: 24,
  action_type: 'pause',
  action_value: '',
  action_value_type: 'percentage',
  cooldown_hours: 6,
  notify_whatsapp: false,
  notify_email: false,
  webhook_url: '',
  webhook_secret: '',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function getMetricLabel(m: string) {
  return METRICS.find(x => x.value === m)?.label || m
}

function getOperatorLabel(op: string) {
  return OPERATORS.find(x => x.value === op)?.label || op
}

function getActionLabel(a: string) {
  return ACTIONS.find(x => x.value === a)?.label || a
}

function getLevelLabel(l: string) {
  return ENTITY_LEVELS.find(x => x.value === l)?.label || l
}

export default function RulesPage() {
  const params = useParams()
  const accountId = params.accountId as string

  const [rules, setRules] = useState<AutomationRule[]>([])
  const [logs, setLogs] = useState<RuleLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null)
  const [form, setForm] = useState<FormData>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'rules' | 'log'>('rules')

  const fetchRules = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/meta-ads/rules?ad_account_id=${accountId}`)
    const json = await res.json()
    setRules(json.rules || [])
    setLoading(false)
  }, [accountId])

  const fetchLogs = useCallback(async () => {
    const res = await fetch(`/api/meta-ads/rules/log?rule_id=&limit=20&offset=0`)
    const json = await res.json()
    setLogs(json.logs || [])
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { fetchRules() }, [fetchRules])
  useEffect(() => { if (activeTab === 'log') fetchLogs() }, [activeTab, fetchLogs])
  /* eslint-enable react-hooks/set-state-in-effect */

  function openCreate() {
    setEditingRule(null)
    setForm(defaultForm)
    setShowForm(true)
  }

  function openEdit(rule: AutomationRule) {
    setEditingRule(rule)
    setForm({
      name: rule.name,
      entity_level: rule.entity_level,
      entity_ids: rule.entity_ids || [],
      condition_metric: rule.condition_metric,
      condition_operator: rule.condition_operator,
      condition_value: String(rule.condition_value),
      condition_period: rule.condition_period,
      action_type: rule.action_type,
      action_value: rule.action_value != null ? String(rule.action_value) : '',
      action_value_type: rule.action_value_type,
      cooldown_hours: rule.cooldown_hours,
      notify_whatsapp: rule.notify_whatsapp,
      notify_email: rule.notify_email,
      webhook_url: rule.webhook_url || '',
      webhook_secret: rule.webhook_secret || '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name || !form.condition_value) {
      alert('Preencha nome e valor da condicao')
      return
    }

    setSaving(true)
    const body = {
      ...form,
      ad_account_id: accountId,
      condition_value: Number(form.condition_value),
      action_value: form.action_value ? Number(form.action_value) : null,
    }

    const url = editingRule ? `/api/meta-ads/rules/${editingRule.id}` : '/api/meta-ads/rules'
    const method = editingRule ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const json = await res.json()
    if (json.error) {
      alert(`Erro: ${json.error}`)
    } else {
      setShowForm(false)
      fetchRules()
    }
    setSaving(false)
  }

  async function handleToggle(rule: AutomationRule) {
    const res = await fetch(`/api/meta-ads/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
    })
    if (res.ok) fetchRules()
  }

  async function handleDelete(rule: AutomationRule) {
    if (!confirm(`Excluir regra "${rule.name}"?`)) return
    const res = await fetch(`/api/meta-ads/rules/${rule.id}`, { method: 'DELETE' })
    if (res.ok) fetchRules()
  }

  const showBudgetField = form.action_type === 'increase_budget' || form.action_type === 'decrease_budget'

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/dashboard/ads/${accountId}`} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Regras Automatizadas</h1>
                <p className="text-sm text-slate-500">Conta: {accountId}</p>
              </div>
            </div>
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nova Regra
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex gap-0">
            {[
              { key: 'rules' as const, label: 'Regras', count: rules.length },
              { key: 'log' as const, label: 'Historico', count: null },
            ].map(t => (
              <button key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                {t.label}
                {t.count !== null && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="max-w-[1600px] mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-slate-500">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Carregando regras...
              </div>
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <p className="text-sm">Nenhuma regra criada</p>
              <p className="text-xs mt-1">Crie regras para automatizar a gestao das suas campanhas</p>
              <button onClick={openCreate}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                + Nova Regra
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto light-scrollbar">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10 border-b border-slate-200">
                  <tr className="text-left text-slate-500 text-xs uppercase">
                    <th className="px-4 py-3 min-w-[200px]">Nome</th>
                    <th className="px-4 py-3 min-w-[200px]">Condicao</th>
                    <th className="px-4 py-3 min-w-[160px]">Acao</th>
                    <th className="px-4 py-3 w-24">Nivel</th>
                    <th className="px-4 py-3 w-24">Cooldown</th>
                    <th className="px-4 py-3 text-center w-20">Status</th>
                    <th className="px-4 py-3 w-32">Ultimo gatilho</th>
                    <th className="px-4 py-3 text-center w-20">Gatilhos</th>
                    <th className="px-4 py-3 w-24">Notif.</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map(rule => (
                    <tr key={rule.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{rule.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">Criada em {formatDate(rule.created_at)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-700">
                          {getMetricLabel(rule.condition_metric)} {getOperatorLabel(rule.condition_operator)} {rule.condition_value}
                        </span>
                        <div className="text-xs text-slate-400 mt-0.5">Ultimas {rule.condition_period}h</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-700">{getActionLabel(rule.action_type)}</span>
                        {rule.action_value != null && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {rule.action_value}{rule.action_value_type === 'percentage' ? '%' : ' (R$)'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{getLevelLabel(rule.entity_level)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{rule.cooldown_hours}h</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleToggle(rule)} className="focus:outline-none">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            rule.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${rule.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {rule.enabled ? 'Ativa' : 'Inativa'}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {rule.last_triggered_at ? formatDate(rule.last_triggered_at) : <span className="text-slate-400">Nunca</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-medium text-slate-700">{rule.trigger_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {rule.notify_email && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600">Email</span>
                          )}
                          {rule.notify_whatsapp && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-50 text-green-600">Zap</span>
                          )}
                          {rule.webhook_url && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-purple-50 text-purple-600">Webhook</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(rule)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => handleDelete(rule)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Log Tab */}
      {activeTab === 'log' && (
        <div className="max-w-[1600px] mx-auto">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">Nenhum historico de execucao</p>
              <p className="text-xs mt-1">As regras aparecerao aqui quando forem executadas</p>
            </div>
          ) : (
            <div className="overflow-x-auto light-scrollbar">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10 border-b border-slate-200">
                  <tr className="text-left text-slate-500 text-xs uppercase">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Entidade</th>
                    <th className="px-4 py-3">Condicao</th>
                    <th className="px-4 py-3">Acao</th>
                    <th className="px-4 py-3">Resultado</th>
                    <th className="px-4 py-3">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-slate-900">{log.entity_name || log.entity_id}</div>
                        <div className="text-xs text-slate-400">{getLevelLabel(log.entity_level)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {log.condition_met?.metric && (
                          <span>{getMetricLabel(log.condition_met.metric)} {getOperatorLabel(log.condition_met.operator)} {log.condition_met.threshold} = {Number(log.condition_met.actual_value).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{getActionLabel(log.action_taken)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          log.action_result === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {log.action_result === 'success' ? 'Sucesso' : 'Erro'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-red-500">{log.action_error || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto sidebar-scrollbar" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">{editingRule ? 'Editar Regra' : 'Nova Regra'}</h2>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Regra</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Pausar se ROAS baixo"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Entity Level */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nivel de aplicacao</label>
                <select value={form.entity_level} onChange={e => setForm(p => ({ ...p, entity_level: e.target.value, entity_ids: [] }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ENTITY_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <p className="text-xs text-slate-400 mt-1">Deixe vazio para aplicar a todas as entidades deste nivel</p>
              </div>

              {/* Condition */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Condicao</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Metrica</label>
                    <select value={form.condition_metric} onChange={e => setForm(p => ({ ...p, condition_metric: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Operador</label>
                    <select value={form.condition_operator} onChange={e => setForm(p => ({ ...p, condition_operator: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Valor</label>
                    <input type="number" step="0.01" value={form.condition_value}
                      onChange={e => setForm(p => ({ ...p, condition_value: e.target.value }))}
                      placeholder="Ex: 1.5"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Periodo de avaliacao</label>
                  <select value={form.condition_period} onChange={e => setForm(p => ({ ...p, condition_period: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Action */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Acao</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de acao</label>
                    <select value={form.action_type} onChange={e => setForm(p => ({ ...p, action_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {ACTIONS.filter(a => a.levels.includes(form.entity_level)).map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                  {showBudgetField && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Valor</label>
                      <div className="flex gap-2">
                        <input type="number" step="1" value={form.action_value}
                          onChange={e => setForm(p => ({ ...p, action_value: e.target.value }))}
                          placeholder="20"
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <select value={form.action_value_type}
                          onChange={e => setForm(p => ({ ...p, action_value_type: e.target.value }))}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="percentage">%</option>
                          <option value="absolute">R$</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Cooldown entre execucoes</label>
                  <select value={form.cooldown_hours} onChange={e => setForm(p => ({ ...p, cooldown_hours: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value={1}>1 hora</option>
                    <option value={2}>2 horas</option>
                    <option value={6}>6 horas</option>
                    <option value={12}>12 horas</option>
                    <option value={24}>24 horas</option>
                    <option value={48}>48 horas</option>
                  </select>
                </div>
              </div>

              {/* Notifications */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Notificacoes</h3>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.notify_email}
                      onChange={e => setForm(p => ({ ...p, notify_email: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-slate-700">Email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.notify_whatsapp}
                      onChange={e => setForm(p => ({ ...p, notify_whatsapp: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-slate-700">WhatsApp</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Webhook URL (opcional)</label>
                  <input type="url" value={form.webhook_url}
                    onChange={e => setForm(p => ({ ...p, webhook_url: e.target.value }))}
                    placeholder="https://seu-crm.com/api/webhook"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-slate-400 mt-1">URL do webhook para enviar os dados quando a regra disparar.</p>
                </div>
                {form.webhook_url && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Webhook Secret (HMAC)</label>
                    <input type="text" value={form.webhook_secret}
                      onChange={e => setForm(p => ({ ...p, webhook_secret: e.target.value }))}
                      placeholder="Chave secreta para assinar o payload"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <p className="text-xs text-slate-400 mt-1">Se configurado, o payload sera assinado com HMAC-SHA256 no header X-Flowyn-Signature.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Salvando...' : editingRule ? 'Salvar alteracoes' : 'Criar regra'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
