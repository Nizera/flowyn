'use client'

import { Suspense, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldCheck, KeyRound, Building2 } from 'lucide-react'

type AccountType = 'cpf' | 'cnpj'
type ConnectionMode = 'subaccount' | 'standalone'

type AsaasStatus = {
  connected: boolean
  connectionMode?: ConnectionMode
  email?: string
  profile?: {
    full_name?: string | null
    document_number?: string | null
    phone?: string | null
    asaas_wallet_id?: string | null
    asaas_account_id?: string | null
    asaas_company_type?: string | null
    asaas_birth_date?: string | null
    asaas_income_value?: number | null
    asaas_address?: string | null
    asaas_address_number?: string | null
    asaas_complement?: string | null
    asaas_province?: string | null
    asaas_postal_code?: string | null
  }
}

const initialForm = {
  name: '',
  email: '',
  cpfCnpj: '',
  birthDate: '',
  companyType: 'MEI',
  phone: '',
  mobilePhone: '',
  address: '',
  addressNumber: '',
  complement: '',
  province: '',
  postalCode: '',
  incomeValue: '',
}

const asaasCpfSignupUrl = process.env.NEXT_PUBLIC_ASAAS_CPF_SIGNUP_URL || 'https://www.asaas.com/cadastro'
const inputClass = 'h-12 w-full rounded-xl border-0 bg-[#f4f4f6] px-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-orange-500/20'

function PaymentsContent() {
  const [status, setStatus] = useState<AsaasStatus | null>(null)
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('subaccount')
  const [accountType, setAccountType] = useState<AccountType>('cpf')
  const [form, setForm] = useState(initialForm)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/asaas/account')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao verificar Asaas')

      setStatus(data)
      if (data.connectionMode) setConnectionMode(data.connectionMode)
      const profile = data.profile || {}
      const documentDigits = (profile.document_number || '').replace(/\D/g, '')
      if (documentDigits.length > 11) setAccountType('cnpj')
      setForm(current => ({
        ...current,
        name: profile.full_name || '',
        email: data.email || '',
        cpfCnpj: profile.document_number || '',
        phone: profile.phone || '',
        mobilePhone: profile.phone || '',
        companyType: profile.asaas_company_type || 'MEI',
        birthDate: profile.asaas_birth_date || '',
        incomeValue: profile.asaas_income_value ? String(profile.asaas_income_value) : '',
        address: profile.asaas_address || '',
        addressNumber: profile.asaas_address_number || '',
        complement: profile.asaas_complement || '',
        province: profile.asaas_province || '',
        postalCode: profile.asaas_postal_code || '',
      }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err) || 'Erro de conexao')
    } finally {
      setLoading(false)
    }
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function selectAccountType(type: AccountType) {
    setAccountType(type)
    setForm(prev => ({
      ...prev,
      cpfCnpj: '',
      companyType: type === 'cpf' ? 'INDIVIDUAL' : 'MEI',
    }))
  }

  async function handleSubmitStandalone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/asaas/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'standalone', api_key: apiKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao vincular conta Asaas')

      setSuccess(data.message || 'Conta Asaas vinculada com sucesso.')
      setApiKey('')
      await loadStatus()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err) || 'Erro de conexao')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitSubaccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/asaas/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, accountType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar cadastro Asaas')

      setSuccess(data.created ? 'Carteira Asaas criada e salva.' : 'Cadastro Asaas atualizado.')
      await loadStatus()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err) || 'Erro de conexao')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    )
  }

  const connected = Boolean(status?.connected)
  const walletId = status?.profile?.asaas_wallet_id
  const accountId = status?.profile?.asaas_account_id
  const isCpf = accountType === 'cpf'
  const mode = status?.connectionMode || connectionMode

  return (
    <section className="overflow-hidden rounded-[10px] bg-white px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Pagamentos</h2>
          <p className="mt-2 text-sm text-slate-400">Conecte sua carteira Asaas para receber vendas dos checkouts.</p>
        </div>
        <button onClick={loadStatus} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      <div className="mt-10 max-w-6xl">
        <div className="border-y border-slate-200">
          <RowTitle title="Status" description="Carteira conectada a sua conta." />
          <div className="py-6">
            <div className="grid gap-6 md:grid-cols-4">
              <StatusItem
                label="Conexao"
                value={connected ? 'Asaas conectado' : 'Asaas nao conectado'}
                tone={connected ? 'success' : 'muted'}
              />
              <StatusItem label="Modo" value={mode === 'standalone' ? 'Conta propria' : 'Subconta Flowyn'} />
              <StatusItem label="Wallet ID" value={walletId || '-'} mono />
              <StatusItem label="Conta Asaas" value={accountId || '-'} mono />
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-orange-50 px-4 py-3 text-sm leading-6 text-orange-900 ring-1 ring-orange-100">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
              <p>A Flowyn nao cobra taxa propria por venda. Cartao, Pix, boleto, antecipacao e regras financeiras seguem as tarifas da Asaas.</p>
            </div>
          </div>
        </div>

        {!connected && (
          <div className="border-b border-slate-200">
            <RowTitle title="Modo de conexao" description="Escolha como deseja receber seus pagamentos." />
            <div className="py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setConnectionMode('standalone')}
                  className={`flex items-start gap-4 rounded-xl border-2 p-5 text-left transition ${
                    connectionMode === 'standalone'
                      ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-200'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    connectionMode === 'standalone' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Minha conta Asaas</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Cola sua API key do Asaas. Pagamento vai direto pra sua conta. Sem subconta, sem split.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setConnectionMode('subaccount')}
                  className={`flex items-start gap-4 rounded-xl border-2 p-5 text-left transition ${
                    connectionMode === 'subaccount'
                      ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-200'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    connectionMode === 'subaccount' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Subconta Flowyn</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Flowyn cria uma subconta no Asaas. Pagamento passa pela Flowyn com split 100% pra voce.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {connected && mode === 'standalone' && (
          <form onSubmit={handleSubmitStandalone} className="border-b border-slate-200">
            <RowTitle title="Conta Asaas" description="Sua API key esta vinculada." />
            <div className="py-6">
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <p>Sua conta Asaas esta conectada. Pagamentos vao direto pra sua conta.</p>
              </div>
            </div>
          </form>
        )}

        {connected && mode === 'subaccount' && (
          <form onSubmit={handleSubmitSubaccount}>
            <SubaccountForm
              form={form}
              updateField={updateField}
              accountType={accountType}
              selectAccountType={selectAccountType}
              isCpf={isCpf}
            />
          </form>
        )}

        {!connected && connectionMode === 'standalone' && (
          <form onSubmit={handleSubmitStandalone}>
            <div className="border-b border-slate-200">
              <RowTitle title="API Key" description="Cole sua API key do Asaas para vincular sua conta." />
              <div className="space-y-5 py-6">
                <div className="flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-700 ring-1 ring-blue-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Para gerar sua API key, acesse o{' '}
                    <a href="https://www.asaas.com/api" target="_blank" rel="noreferrer" className="underline font-semibold">painel Asaas &gt; API</a>,{' '}
                    crie um novo token com permissao de <strong>Cobrancas</strong> e cole abaixo.
                  </p>
                </div>
                <Field label="API Key do Asaas" required>
                  <input
                    required
                    type="password"
                    placeholder="cole sua API key aqui"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            {(error || success) && (
              <div className="mt-6">
                {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-100">{error}</div>}
                {success && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">{success}</div>}
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={saving || !apiKey.trim()}
                className="inline-flex h-11 min-w-64 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Vincular conta Asaas
              </button>
            </div>
          </form>
        )}

        {!connected && connectionMode === 'subaccount' && (
          <form onSubmit={handleSubmitSubaccount}>
            <SubaccountForm
              form={form}
              updateField={updateField}
              accountType={accountType}
              selectAccountType={selectAccountType}
              isCpf={isCpf}
            />
          </form>
        )}
      </div>
    </section>
  )
}

function SubaccountForm({
  form,
  updateField,
  accountType,
  selectAccountType,
  isCpf,
}: {
  form: typeof initialForm
  updateField: (field: keyof typeof form, value: string) => void
  accountType: AccountType
  selectAccountType: (type: AccountType) => void
  isCpf: boolean
}) {
  return (
    <>
      <div className="border-b border-slate-200">
        <RowTitle title="Tipo" description="Pessoa fisica ou juridica." />
        <div className="py-6">
          <div className="flex max-w-xl rounded-xl bg-[#f4f4f6] p-1">
            <button
              type="button"
              onClick={() => selectAccountType('cpf')}
              className={`h-10 flex-1 rounded-lg text-sm font-semibold transition ${isCpf ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              CPF
            </button>
            <button
              type="button"
              onClick={() => selectAccountType('cnpj')}
              className={`h-10 flex-1 rounded-lg text-sm font-semibold transition ${!isCpf ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              CNPJ
            </button>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            {isCpf
              ? 'Para CPF, a Flowyn vincula ou cria uma subconta Pessoa Fisica no Asaas pelo documento informado.'
              : 'Para CNPJ, a Flowyn cria ou atualiza uma subconta Pessoa Juridica via API.'}
          </p>
        </div>
      </div>

      {isCpf && (
        <div className="border-b border-slate-200">
          <RowTitle title="Conta CPF" description="Criacao feita no Asaas." />
          <div className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              Ao clicar em Vincular, a Flowyn cria automaticamente uma subconta Pessoa Fisica no Asaas vinculada a sua conta.
            </p>
            <a href={asaasCpfSignupUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600">
              Criar conta CPF <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}

      <div className="border-b border-slate-200">
        <RowTitle title="Dados Asaas" description={isCpf ? 'Dados para vinculo da subconta.' : 'Dados para criacao ou atualizacao.'} />
        <div className="space-y-5 py-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label={isCpf ? 'Nome completo' : 'Razao social'} required><input required value={form.name} onChange={e => updateField('name', e.target.value)} className={inputClass} /></Field>
            <Field label="E-mail da conta Asaas" required><input required type="email" value={form.email} onChange={e => updateField('email', e.target.value)} className={inputClass} /></Field>
            <Field label={isCpf ? 'CPF' : 'CNPJ'} required><input required value={form.cpfCnpj} maxLength={isCpf ? 11 : 14} onChange={e => updateField('cpfCnpj', e.target.value.replace(/\D/g, '').slice(0, isCpf ? 11 : 14))} className={inputClass} /></Field>
            <Field label={isCpf ? 'Data de nascimento' : 'Data de abertura'} required={isCpf}><input required={isCpf} type="date" value={form.birthDate} onChange={e => updateField('birthDate', e.target.value)} className={inputClass} /></Field>
            {!isCpf && (
              <Field label="Tipo de empresa">
                <select value={form.companyType} onChange={e => updateField('companyType', e.target.value)} className={inputClass}>
                  <option value="MEI">MEI</option>
                  <option value="LIMITED">Limitada</option>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="ASSOCIATION">Associacao</option>
                </select>
              </Field>
            )}
            <Field label="Faturamento mensal estimado" required><input required type="number" min="1" step="0.01" value={form.incomeValue} onChange={e => updateField('incomeValue', e.target.value)} className={inputClass} /></Field>
            <Field label="Telefone fixo"><input value={form.phone} onChange={e => updateField('phone', e.target.value.replace(/\D/g, ''))} className={inputClass} /></Field>
            <Field label="Celular" required><input required value={form.mobilePhone} onChange={e => updateField('mobilePhone', e.target.value.replace(/\D/g, ''))} className={inputClass} /></Field>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <RowTitle title="Endereco" description="Dados cadastrais da conta." />
        <div className="grid gap-5 py-6 md:grid-cols-2">
          <Field label="Endereco"><input value={form.address} onChange={e => updateField('address', e.target.value)} className={inputClass} /></Field>
          <Field label="Numero" required><input required value={form.addressNumber} onChange={e => updateField('addressNumber', e.target.value)} className={inputClass} /></Field>
          <Field label="Complemento"><input value={form.complement} onChange={e => updateField('complement', e.target.value)} className={inputClass} /></Field>
          <Field label="Bairro"><input value={form.province} onChange={e => updateField('province', e.target.value)} className={inputClass} /></Field>
          <Field label="CEP" required><input required value={form.postalCode} onChange={e => updateField('postalCode', e.target.value.replace(/\D/g, ''))} className={inputClass} /></Field>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          className="inline-flex h-11 min-w-64 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-50"
        >
          Vincular carteira Asaas
        </button>
      </div>
    </>
  )
}

function StatusItem({ label, value, tone = 'muted', mono = false }: { label: string; value: string; tone?: 'success' | 'muted'; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-2 flex items-start gap-2">
        {tone === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
        <p className={`break-all text-sm font-semibold text-slate-950 ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  )
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}

function RowTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="pt-6">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  )
}

export default function PaymentsSettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></div>}>
      <PaymentsContent />
    </Suspense>
  )
}
