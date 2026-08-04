'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Circle, ArrowRight, ArrowLeft, ExternalLink, Copy, Check, AlertTriangle, Loader2 } from 'lucide-react'

interface Step {
  id: string
  title: string
  description: string
}

const STEPS: Step[] = [
  { id: 'connect', title: 'Conectar Meta', description: 'Autorize o acesso à sua conta Meta' },
  { id: 'accounts', title: 'Selecionar Contas', description: 'Escolha suas contas de anúncios' },
  { id: 'pixel', title: 'Configurar Pixel', description: 'Crie ou vincule seu pixel' },
  { id: 'capi', title: 'Token CAPI', description: 'Configure a Conversions API' },
  { id: 'verify', title: 'Verificar', description: 'Teste se o rastreamento está funcionando' },
]

export default function SetupWizardPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  // Step data
  const [hasMetaConnection, setHasMetaConnection] = useState(false)
  const [accounts, setAccounts] = useState<Array<{ account_id: string; name: string }>>([])
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [pixelId, setPixelId] = useState('')
  const [pixelName, setPixelName] = useState('')
  const [capiToken, setCapiToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Check Meta connection status
  useEffect(() => {
    async function checkConnection() {
      try {
        const res = await fetch('/api/meta-ads/setup/accounts')
        if (res.ok) {
          const data = await res.json()
          setHasMetaConnection(true)
          setAccounts(data.accounts || [])
          const existing = data.existing || []
          if (existing.length > 0) {
            setSelectedAccounts(new Set(existing.map((e: any) => e.ad_account_id)))
            setCompletedSteps(prev => new Set([...prev, 0, 1]))
          }
        }
      } catch {
        setHasMetaConnection(false)
      } finally {
        setLoading(false)
      }
    }
    checkConnection()
  }, [])

  function goNext() {
    if (currentStep < STEPS.length - 1) {
      setCompletedSteps(prev => new Set([...prev, currentStep]))
      setCurrentStep(currentStep + 1)
    }
  }

  function goPrev() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  function handleConnect() {
    // Redirect to Meta OAuth
    window.location.href = '/api/meta-ads/oauth'
  }

  function toggleAccount(id: string) {
    setSelectedAccounts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSaveAccounts() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/meta-ads/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accounts: accounts
            .filter(a => selectedAccounts.has(a.account_id))
            .map(a => ({ account_id: a.account_id, name: a.name, sync_enabled: true })),
        }),
      })
      if (res.ok) {
        setCompletedSteps(prev => new Set([...prev, currentStep]))
        goNext()
      } else {
        setError('Erro ao salvar contas')
      }
    } catch {
      setError('Erro ao conectar com o servidor')
    } finally {
      setSaving(false)
    }
  }

  function handleSkipCapi() {
    setCompletedSteps(prev => new Set([...prev, currentStep]))
    goNext()
  }

  function copySnippet() {
    const snippet = `<script src="${window.location.origin}/t/YOUR_PUBLIC_TOKEN.js" async defer></script>`
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Progress bar */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-foreground">Configuração do Rastreamento</h1>
            <span className="text-xs text-muted">
              Passo {currentStep + 1} de {STEPS.length}
            </span>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((step, i) => (
              <div
                key={step.id}
                className={`h-1.5 flex-1 rounded-full transition ${
                  i < currentStep || completedSteps.has(i)
                    ? 'bg-primary'
                    : i === currentStep
                    ? 'bg-primary/50'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-4 mt-3">
            {STEPS.map((step, i) => (
              <div
                key={step.id}
                className={`flex items-center gap-1.5 text-xs ${
                  i === currentStep
                    ? 'text-primary font-semibold'
                    : completedSteps.has(i)
                    ? 'text-green-400'
                    : 'text-muted'
                }`}
              >
                {completedSteps.has(i) ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="mx-auto max-w-3xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Step 0: Connect Meta */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Conectar conta Meta</h2>
              <p className="text-sm text-muted mt-1">
                Autorize o acesso para sincronizar dados das suas campanhas de Facebook e Instagram.
              </p>
            </div>

            {hasMetaConnection ? (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                  <div>
                    <p className="font-semibold text-foreground">Conta Meta conectada</p>
                    <p className="text-sm text-muted">Sua conta Meta já está autorizada.</p>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="w-full rounded-xl bg-[#1877f2] px-6 py-4 text-left transition hover:bg-[#166fe5]"
              >
                <div className="flex items-center gap-4">
                  <img src="/meta.png" alt="" className="h-10 w-10 rounded-lg" />
                  <div className="flex-1">
                    <p className="font-bold text-white">Conectar com Meta</p>
                    <p className="text-sm text-white/70">Facebook & Instagram Ads</p>
                  </div>
                  <ExternalLink className="h-5 w-5 text-white/50" />
                </div>
              </button>
            )}

            <div className="flex justify-end">
              <button
                onClick={goNext}
                disabled={!hasMetaConnection}
                className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Próximo <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Select Accounts */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Selecionar contas de anúncios</h2>
              <p className="text-sm text-muted mt-1">
                Escolha quais contas terão os dados sincronizados no dashboard.
              </p>
            </div>

            {accounts.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-muted">
                Nenhuma conta de anúncios encontrada.
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map(acc => (
                  <label
                    key={acc.account_id}
                    className={`flex items-center gap-4 rounded-xl border bg-card p-4 cursor-pointer transition hover:bg-surface ${
                      selectedAccounts.has(acc.account_id)
                        ? 'border-primary ring-1 ring-primary/20'
                        : 'border-border'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAccounts.has(acc.account_id)}
                      onChange={() => toggleAccount(acc.account_id)}
                      className="h-4 w-4 rounded text-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{acc.name}</p>
                      <p className="font-mono text-xs text-muted">{acc.account_id}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={goPrev}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-surface"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <button
                onClick={handleSaveAccounts}
                disabled={selectedAccounts.size === 0 || saving}
                className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar e continuar'} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Pixel */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Configurar Pixel</h2>
              <p className="text-sm text-muted mt-1">
                O pixel rastreia visitantes na sua landing page e conecta ao checkout.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div>
                <label className="block text-xs text-muted mb-1">ID do Pixel Meta</label>
                <input
                  type="text"
                  value={pixelId}
                  onChange={e => setPixelId(e.target.value)}
                  placeholder="Ex: 1037638165674462"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Nome (opcional)</label>
                <input
                  type="text"
                  value={pixelName}
                  onChange={e => setPixelName(e.target.value)}
                  placeholder="Ex: Pixel Principal"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
                <div className="text-sm text-blue-300">
                  <p className="font-semibold">Onde encontrar?</p>
                  <p className="mt-1">
                    No Meta Events Manager, copie o ID do pixel listado na coluna "ID do pixel".
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={goPrev}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-surface"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <button
                onClick={() => {
                  setCompletedSteps(prev => new Set([...prev, currentStep]))
                  goNext()
                }}
                className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary/90"
              >
                Continuar <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: CAPI Token */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Token da Conversions API</h2>
              <p className="text-sm text-muted mt-1">
                Opcional, mas recomendado. Melhora a precisão do rastreamento em 20-30%.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div>
                <label className="block text-xs text-muted mb-1">Access Token (CAPI)</label>
                <input
                  type="password"
                  value={capiToken}
                  onChange={e => setCapiToken(e.target.value)}
                  placeholder="Cole o token de acesso do pixel"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <div className="text-sm text-amber-300">
                  <p className="font-semibold">Como obter o token:</p>
                  <ol className="mt-1 list-decimal list-inside space-y-1">
                    <li>No Meta Events Manager, clique em "Configurações"</li>
                    <li>Role até "Token de acesso da API de Conversões"</li>
                    <li>Gere um token com permissão de <strong>Gerenciar</strong></li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={goPrev}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-surface"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleSkipCapi}
                  className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-muted transition hover:bg-surface"
                >
                  Pular
                </button>
                <button
                  onClick={() => {
                    setCompletedSteps(prev => new Set([...prev, currentStep]))
                    goNext()
                  }}
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary/90"
                >
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Verify */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Verificar rastreamento</h2>
              <p className="text-sm text-muted mt-1">
                Teste se tudo está funcionando antes de criar suas campanhas.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Snippet de rastreamento</h3>
              <p className="text-sm text-muted">
                Adicione este snippet na &lt;head&gt; da sua landing page:
              </p>
              <div className="relative">
                <pre className="rounded-lg bg-[#0a0a0f] p-4 text-xs text-green-400 overflow-x-auto">
{`<script src="${typeof window !== 'undefined' ? window.location.origin : 'https://www.flowyn.com.br'}/t/YOUR_PUBLIC_TOKEN.js" async defer></script>`}
                </pre>
                <button
                  onClick={copySnippet}
                  className="absolute right-2 top-2 rounded-lg bg-white/10 p-2 text-muted hover:text-foreground transition"
                >
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Script de UTM (recomendado)</h3>
              <p className="text-sm text-muted">
                Para rastrear UTMs da landing page, adicione também:
              </p>
              <pre className="rounded-lg bg-[#0a0a0f] p-4 text-xs text-green-400 overflow-x-auto">
{`<script src="${typeof window !== 'undefined' ? window.location.origin : 'https://www.flowyn.com.br'}/api/producer-script" async defer></script>`}
              </pre>
            </div>

            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-green-400" />
                <div>
                  <p className="font-bold text-foreground">Configuração completa!</p>
                  <p className="text-sm text-muted mt-1">
                    Após adicionar os snippets, suas vendas serão rastreadas automaticamente.
                    Acesse <strong>Diagnóstico</strong> para verificar se tudo está funcionando.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={goPrev}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-surface"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <button
                onClick={() => router.push('/dashboard/diagnostics')}
                className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary/90"
              >
                Ver Diagnóstico <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
