'use client'

import { Suspense, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, ShieldCheck, Wallet } from 'lucide-react'

type AsaasStatus = {
  connected: boolean
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

function PaymentsContent() {
  const [status, setStatus] = useState<AsaasStatus | null>(null)
  const [form, setForm] = useState(initialForm)
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
      const profile = data.profile || {}
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
    } catch (err: any) {
      setError(err.message || 'Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/asaas/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar cadastro Asaas')

      setSuccess(data.created ? 'Carteira Asaas criada e salva.' : 'Cadastro Asaas atualizado.')
      await loadStatus()
    } catch (err: any) {
      setError(err.message || 'Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#00e88a]" />
      </div>
    )
  }

  const connected = Boolean(status?.connected)
  const walletId = status?.profile?.asaas_wallet_id

  const inputClass = 'w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/25 focus:border-[#00e88a] focus:ring-2 focus:ring-[#00e88a]/10 outline-none transition-all'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Wallet className="w-7 h-7 text-[#00e88a]" />
            Pagamentos Asaas
          </h1>
          <p className="text-white/50 mt-1">
            Cadastre sua subconta Asaas para receber vendas e splits. A Flowyn não cobra taxa por venda.
          </p>
        </div>
        <button onClick={loadStatus} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className={`border rounded-2xl p-5 ${connected ? 'bg-[#00e88a]/5 border-[#00e88a]/20' : 'bg-[#111111] border-white/10'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${connected ? 'bg-[#00e88a]/10' : 'bg-white/5'}`}>
            {connected ? <CheckCircle2 className="w-5 h-5 text-[#00e88a]" /> : <AlertCircle className="w-5 h-5 text-white/40" />}
          </div>
          <div>
            <h2 className="font-semibold text-white">{connected ? 'Asaas conectado' : 'Asaas não conectado'}</h2>
            <p className="text-sm text-white/50">
              {connected ? `Wallet ID: ${walletId}` : 'Preencha o cadastro obrigatório para gerar seu Wallet ID.'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#111111] border border-white/10 rounded-2xl p-6 space-y-6">
        <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-4">
          <h3 className="text-white font-medium mb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#00e88a]" />
            Dados exigidos pela Asaas
          </h3>
          <p className="text-sm text-white/50">
            Se a carteira já existir, estes dados atualizam seu cadastro local e preservam o Wallet ID salvo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome / razão social">
            <input required value={form.name} onChange={e => updateField('name', e.target.value)} className={inputClass} />
          </Field>
          <Field label="E-mail da conta Asaas">
            <input required type="email" value={form.email} onChange={e => updateField('email', e.target.value)} className={inputClass} />
          </Field>
          <Field label="CPF/CNPJ">
            <input required value={form.cpfCnpj} onChange={e => updateField('cpfCnpj', e.target.value.replace(/\D/g, ''))} className={inputClass} />
          </Field>
          <Field label="Data de nascimento / abertura">
            <input type="date" value={form.birthDate} onChange={e => updateField('birthDate', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Tipo de empresa">
            <select value={form.companyType} onChange={e => updateField('companyType', e.target.value)} className={inputClass}>
              <option value="MEI">MEI</option>
              <option value="LIMITED">Limitada</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="ASSOCIATION">Associação</option>
            </select>
          </Field>
          <Field label="Faturamento mensal estimado">
            <input required type="number" min="1" step="0.01" value={form.incomeValue} onChange={e => updateField('incomeValue', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Telefone fixo">
            <input value={form.phone} onChange={e => updateField('phone', e.target.value.replace(/\D/g, ''))} className={inputClass} />
          </Field>
          <Field label="Celular">
            <input required value={form.mobilePhone} onChange={e => updateField('mobilePhone', e.target.value.replace(/\D/g, ''))} className={inputClass} />
          </Field>
          <Field label="Endereço">
            <input value={form.address} onChange={e => updateField('address', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Número">
            <input required value={form.addressNumber} onChange={e => updateField('addressNumber', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Complemento">
            <input value={form.complement} onChange={e => updateField('complement', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Bairro">
            <input value={form.province} onChange={e => updateField('province', e.target.value)} className={inputClass} />
          </Field>
          <Field label="CEP">
            <input required value={form.postalCode} onChange={e => updateField('postalCode', e.target.value.replace(/\D/g, ''))} className={inputClass} />
          </Field>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>}
        {success && <div className="bg-[#00e88a]/10 border border-[#00e88a]/20 text-[#00e88a] px-4 py-3 rounded-xl text-sm">{success}</div>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#00e88a] hover:bg-[#00e88a]/90 text-black font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : connected ? 'Atualizar cadastro Asaas' : 'Criar carteira Asaas'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  )
}

export default function PaymentsSettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#00e88a]" /></div>}>
      <PaymentsContent />
    </Suspense>
  )
}
