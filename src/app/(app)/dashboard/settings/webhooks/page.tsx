'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle, CheckCircle2, Loader2, Plus, Trash2, Webhook,
  Eye, EyeOff, Copy, ExternalLink, Zap
} from 'lucide-react'

type WebhookEvent =
  | 'subscription.created'
  | 'subscription.renewed'
  | 'subscription.canceled'
  | 'subscription.payment_failed'
  | 'subscription.trial_ending'
  | 'payment.confirmed'
  | 'payment.failed'
  | 'payment.refunded'

interface Webhook {
  id: string
  url: string
  events: WebhookEvent[]
  is_active: boolean
  description: string | null
  last_triggered_at: string | null
  last_response_status: number | null
  delivery_count: number
  success_count: number
  created_at: string
}

interface WebhookDelivery {
  id: string
  webhook_id: string
  event: WebhookEvent
  success: boolean
  response_status: number | null
  attempt_count: number
  created_at: string
}

const ALL_EVENTS: { value: WebhookEvent; label: string; description: string }[] = [
  { value: 'subscription.created', label: 'Assinatura Criada', description: 'Quando um cliente cria uma nova assinatura' },
  { value: 'subscription.renewed', label: 'Assinatura Renovada', description: 'Quando uma assinatura é renovada com sucesso' },
  { value: 'subscription.canceled', label: 'Assinatura Cancelada', description: 'Quando uma assinatura é cancelada' },
  { value: 'subscription.payment_failed', label: 'Pagamento da Assinatura Falhou', description: 'Quando o pagamento de uma assinatura falha' },
  { value: 'subscription.trial_ending', label: 'Trial Terminando', description: '3 dias antes do trial terminar' },
  { value: 'payment.confirmed', label: 'Pagamento Confirmado', description: 'Quando um pagamento único é confirmado' },
  { value: 'payment.failed', label: 'Pagamento Falhou', description: 'Quando um pagamento único falha' },
  { value: 'payment.refunded', label: 'Pagamento Reembolsado', description: 'Quando um pagamento é reembolsado' },
]

const inputClass = 'h-12 w-full rounded-xl border-0 bg-surface px-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted focus:bg-card focus:ring-2 focus:ring-orange-500/20'

function WebhookEventsBadge({ events }: { events: WebhookEvent[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {events.map((e) => (
        <span key={e} className="inline-flex items-center rounded-lg bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-400">
          {e.split('.')[1]}
        </span>
      ))}
    </div>
  )
}

function StatusBadge({ success, statusCode }: { success: boolean; statusCode: number | null }) {
  if (statusCode === null) return <span className="text-xs text-muted">Pendente</span>
  if (success) return <span className="inline-flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="h-3 w-3" /> {statusCode}</span>
  return <span className="inline-flex items-center gap-1 text-xs text-red-400"><AlertCircle className="h-3 w-3" /> {statusCode}</span>
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newEvents, setNewEvents] = useState<WebhookEvent[]>(['subscription.created', 'subscription.canceled'])
  const [creating, setCreating] = useState(false)
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'webhooks' | 'deliveries'>('webhooks')

  useEffect(() => {
    loadWebhooks()
  }, [])

  async function loadWebhooks() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/webhooks/config')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar webhooks')
      setWebhooks(data.webhooks || [])
      setDeliveries(data.deliveries || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  async function createWebhook() {
    if (!newUrl) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/webhooks/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl, description: newDescription, events: newEvents }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar webhook')
      setSecrets(prev => ({ ...prev, [data.webhook.id]: data.secret }))
      setShowNewForm(false)
      setNewUrl('')
      setNewDescription('')
      setNewEvents(['subscription.created', 'subscription.canceled'])
      setSuccess('Webhook criado com sucesso! Guarde o secret abaixo.')
      await loadWebhooks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar')
    } finally {
      setCreating(false)
    }
  }

  async function deleteWebhook(id: string) {
    if (!confirm('Tem certeza que deseja excluir este webhook?')) return
    setError(null)
    try {
      const res = await fetch(`/api/webhooks/config?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao excluir')
      }
      setSuccess('Webhook excluído')
      await loadWebhooks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  async function toggleWebhook(id: string, isActive: boolean) {
    setError(null)
    try {
      const res = await fetch('/api/webhooks/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !isActive }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar')
      await loadWebhooks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar')
    }
  }

  async function testWebhook(id: string) {
    setTesting(id)
    setError(null)
    try {
      const res = await fetch('/api/webhooks/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, webhook_id: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao testar')
      setSuccess('Teste enviado! Verifique a URL configurada.')
      await loadWebhooks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao testar')
    } finally {
      setTesting(null)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setSuccess('Copiado!')
  }

  if (loading) {
    return (
      <section className="overflow-hidden rounded-[10px] bg-card px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
        </div>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-[10px] bg-card px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Webhooks</h2>
          <p className="mt-1 text-sm text-muted">
            Configure URLs para receber notificações de eventos de assinatura e pagamento.
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600"
        >
          <Plus className="h-4 w-4" />
          Novo Webhook
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-green-500/10 px-4 py-3 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-400 hover:text-green-300">&times;</button>
        </div>
      )}

      {showNewForm && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-6">
          <h3 className="text-sm font-semibold text-foreground">Novo Webhook</h3>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">URL do Webhook *</label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://seudominio.com/api/webhook/flowyn"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Descrição (opcional)</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Ex: DreamLog - Produção de assinaturas"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted">Eventos para escutar</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ALL_EVENTS.map((evt) => (
                  <label
                    key={evt.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                      newEvents.includes(evt.value)
                        ? 'border-orange-500/50 bg-orange-500/5'
                        : 'border-border bg-surface hover:bg-card'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={newEvents.includes(evt.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewEvents([...newEvents, evt.value])
                        } else {
                          setNewEvents(newEvents.filter(ev => ev !== evt.value))
                        }
                      }}
                      className="h-4 w-4 rounded border-border accent-orange-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground">{evt.label}</span>
                      <span className="block text-xs text-muted">{evt.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={createWebhook}
              disabled={creating || !newUrl}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar Webhook
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-6 text-sm font-medium text-foreground transition hover:bg-surface"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-1 rounded-xl bg-surface p-1">
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            activeTab === 'webhooks' ? 'bg-card text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          <Webhook className="mr-1.5 inline h-4 w-4" />
          Webhooks ({webhooks.length})
        </button>
        <button
          onClick={() => setActiveTab('deliveries')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            activeTab === 'deliveries' ? 'bg-card text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          <Zap className="mr-1.5 inline h-4 w-4" />
          Entregas Recentes ({deliveries.length})
        </button>
      </div>

      {activeTab === 'webhooks' && (
        <div className="mt-6 space-y-3">
          {webhooks.length === 0 ? (
            <div className="py-12 text-center">
              <Webhook className="mx-auto h-10 w-10 text-muted" />
              <p className="mt-3 text-sm text-muted">Nenhum webhook configurado</p>
              <p className="mt-1 text-xs text-muted">Clique em &quot;Novo Webhook&quot; para começar</p>
            </div>
          ) : (
            webhooks.map((wh) => (
              <div key={wh.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${wh.is_active ? 'bg-green-400' : 'bg-gray-400'}`} />
                      <span className="text-sm font-medium text-foreground truncate">{wh.url}</span>
                      <a href={wh.url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-foreground">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    {wh.description && (
                      <p className="mt-1 text-xs text-muted">{wh.description}</p>
                    )}
                    <div className="mt-2">
                      <WebhookEventsBadge events={wh.events} />
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted">
                      <span>{wh.delivery_count} entregas</span>
                      <span>{wh.success_count} sucesso</span>
                      {wh.last_triggered_at && (
                        <span>Último envio: {new Date(wh.last_triggered_at).toLocaleDateString('pt-BR')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => testWebhook(wh.id)}
                      disabled={testing === wh.id}
                      className="rounded-lg p-2 text-muted transition hover:bg-card hover:text-foreground"
                      title="Testar"
                    >
                      {testing === wh.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => toggleWebhook(wh.id, wh.is_active)}
                      className={`rounded-lg p-2 transition ${wh.is_active ? 'text-green-400 hover:bg-green-500/10' : 'text-muted hover:bg-card'}`}
                      title={wh.is_active ? 'Desativar' : 'Ativar'}
                    >
                      {wh.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => deleteWebhook(wh.id)}
                      className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-400"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {secrets[wh.id] && (
                  <div className="mt-3 rounded-lg bg-orange-500/5 border border-orange-500/20 p-3">
                    <p className="text-xs font-medium text-orange-400">Secret (guarde! não será mostrado novamente):</p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 rounded bg-surface px-2 py-1 text-xs text-foreground font-mono">{secrets[wh.id]}</code>
                      <button onClick={() => copyToClipboard(secrets[wh.id])} className="text-muted hover:text-foreground">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'deliveries' && (
        <div className="mt-6">
          {deliveries.length === 0 ? (
            <div className="py-12 text-center">
              <Zap className="mx-auto h-10 w-10 text-muted" />
              <p className="mt-3 text-sm text-muted">Nenhuma entrega registrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="pb-3 font-medium">Evento</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Tentativas</th>
                    <th className="pb-3 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deliveries.map((d) => (
                    <tr key={d.id} className="hover:bg-surface/50">
                      <td className="py-3">
                        <span className="inline-flex items-center rounded-lg bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-400">
                          {d.event}
                        </span>
                      </td>
                      <td className="py-3">
                        <StatusBadge success={d.success} statusCode={d.response_status} />
                      </td>
                      <td className="py-3 text-xs text-muted">{d.attempt_count}</td>
                      <td className="py-3 text-xs text-muted">
                        {new Date(d.created_at).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 rounded-xl border border-border bg-surface p-6">
        <h3 className="text-sm font-semibold text-foreground">Como funciona</h3>
        <div className="mt-3 space-y-2 text-xs text-muted">
          <p>1. Configure uma URL HTTPS que receba POST requests</p>
          <p>2. Seu servidor deve retornar HTTP 2xx para confirmar recebimento</p>
          <p>3. Em caso de falha, tentaremos novamente com backoff: 1min, 5min, 30min, 1h</p>
          <p>4. Cada request inclui o header <code className="rounded bg-card px-1 py-0.5 text-foreground">X-Flowyn-Signature</code> com HMAC-SHA256 do payload</p>
          <p>5. Verifique a assinatura usando o secret fornecido na criação do webhook</p>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium text-foreground">Exemplo de payload:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-card p-3 text-xs text-muted">
{`{
  "event": "subscription.created",
  "timestamp": "2026-08-05T10:30:00Z",
  "data": {
    "subscription_id": "sub_abc123",
    "customer_email": "luna@email.com",
    "customer_name": "Luna Vieira",
    "plan_name": "DreamLog Pro",
    "billing_cycle": "monthly",
    "amount": 19.90,
    "trial_ends_at": "2026-08-12T10:30:00Z"
  }
}`}
          </pre>
        </div>
      </div>
    </section>
  )
}
