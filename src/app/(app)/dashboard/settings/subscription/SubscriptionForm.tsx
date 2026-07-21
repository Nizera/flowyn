"use client"

import { useState } from 'react'
import { CheckCircle2, CreditCard, Loader2, MapPin, Search, ShieldCheck, XCircle } from 'lucide-react'
import { formatCardNumber, formatCpfCnpj, formatPhone, formatPostalCode, lookupPostalCode, type CepAddress } from '@/lib/brazil-fields'

type SubscriptionFormProps = {
  defaultName: string
  defaultEmail: string
  hasActiveSubscription: boolean
}

export function SubscriptionForm({ defaultName, defaultEmail, hasActiveSubscription }: SubscriptionFormProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [postalCode, setPostalCode] = useState('')
  const [address, setAddress] = useState<CepAddress | null>(null)
  const [postalCodeError, setPostalCodeError] = useState<string | null>(null)
  const [searchingPostalCode, setSearchingPostalCode] = useState(false)

  async function searchPostalCode() {
    if (postalCode.replace(/\D/g, '').length !== 8) {
      setAddress(null)
      setPostalCodeError('Digite os 8 números do CEP.')
      return
    }
    setSearchingPostalCode(true)
    setPostalCodeError(null)
    try {
      setAddress(await lookupPostalCode(postalCode))
    } catch (lookupError) {
      setAddress(null)
      setPostalCodeError(lookupError instanceof Error ? lookupError.message : 'CEP não encontrado.')
    } finally {
      setSearchingPostalCode(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setLoading(true)
    setMessage(null)
    setError(null)

    const form = new FormData(formElement)
    const payload = {
      name: String(form.get('name') || ''),
      email: String(form.get('email') || ''),
      cpfCnpj: String(form.get('cpfCnpj') || ''),
      phone: String(form.get('phone') || ''),
      postalCode: String(form.get('postalCode') || ''),
      addressNumber: String(form.get('addressNumber') || ''),
      addressComplement: String(form.get('addressComplement') || ''),
      card: {
        holderName: String(form.get('holderName') || ''),
        number: String(form.get('cardNumber') || ''),
        expiryMonth: String(form.get('expiryMonth') || ''),
        expiryYear: String(form.get('expiryYear') || ''),
        ccv: String(form.get('ccv') || ''),
      },
    }

    let response: Response
    let data: { error?: string }
    try {
      response = await fetch('/api/platform/subscription', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      })
      data = await response.json()
    } catch {
      setError('Falha de conexão. Tente novamente em instantes.')
      return
    } finally {
      for (const fieldName of ['cardNumber', 'expiryMonth', 'expiryYear', 'ccv']) {
        const field = formElement.elements.namedItem(fieldName)
        if (field instanceof HTMLInputElement) field.value = ''
      }
      setLoading(false)
    }

    if (!response.ok) {
      setError(data.error || 'Nao foi possivel ativar a assinatura.')
      return
    }

    setMessage('Assinatura Flowyn Pro configurada. A primeira cobranca acontece ao fim dos 7 dias gratis.')
    window.location.reload()
  }

  if (hasActiveSubscription) {
    return (
      <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-100">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5" />
          <div>
            <h3 className="font-bold">Assinatura configurada</h3>
            <p className="mt-1 text-emerald-700/75">Sua conta esta liberada para criar produtos e receber vendas sem taxa da Flowyn.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
      <div className="rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-800 ring-1 ring-orange-100">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4" />
          Cobranca segura via Asaas
        </div>
        <p className="mt-2 leading-6 text-orange-800/75">
          A Flowyn não persiste número, CVV ou validade. Eles são enviados ao Asaas somente para configurar a assinatura e descartados após a tentativa.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome completo" name="name" defaultValue={defaultName} />
        <Field label="E-mail" name="email" type="email" defaultValue={defaultEmail} />
        <Field label="CPF/CNPJ" name="cpfCnpj" placeholder="000.000.000-00" inputMode="numeric" maxLength={18} format={formatCpfCnpj} />
        <Field label="Telefone" name="phone" placeholder="(11) 99999-9999" inputMode="tel" maxLength={15} format={formatPhone} />
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-foreground">CEP</span>
          <div className="flex gap-2">
            <input
              name="postalCode"
              required
              inputMode="numeric"
              autoComplete="postal-code"
              value={postalCode}
              onChange={event => {
                setPostalCode(formatPostalCode(event.target.value))
                setAddress(null)
                setPostalCodeError(null)
              }}
              onBlur={() => {
                if (postalCode.replace(/\D/g, '').length === 8 && !address) void searchPostalCode()
              }}
              placeholder="00000-000"
              maxLength={9}
              className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-surface px-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted focus:bg-card focus:ring-2 focus:ring-orange-500/20"
            />
            <button type="button" onClick={() => void searchPostalCode()} disabled={searchingPostalCode || postalCode.replace(/\D/g, '').length !== 8} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:border-orange-300 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-45">
              {searchingPostalCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </button>
          </div>
          {postalCodeError && <span className="mt-2 block text-xs font-medium text-red-600">{postalCodeError}</span>}
        </label>
        <Field label="Número" name="addressNumber" inputMode="numeric" maxLength={10} format={value => value.replace(/\D/g, '').slice(0, 10)} />
        {address && (
          <div className="md:col-span-2 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{[address.street, address.neighborhood, `${address.city} - ${address.state}`].filter(Boolean).join(', ')}</span>
          </div>
        )}
        <div className="md:col-span-2">
          <Field label="Complemento" name="addressComplement" required={false} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome no cartao" name="holderName" defaultValue={defaultName} />
        <Field label="Número do cartão" name="cardNumber" placeholder="0000 0000 0000 0000" inputMode="numeric" autoComplete="off" maxLength={23} format={formatCardNumber} />
        <Field label="Mês" name="expiryMonth" placeholder="MM" inputMode="numeric" autoComplete="off" maxLength={2} format={value => value.replace(/\D/g, '').slice(0, 2)} />
        <Field label="Ano" name="expiryYear" placeholder="AAAA" inputMode="numeric" autoComplete="off" maxLength={4} format={value => value.replace(/\D/g, '').slice(0, 4)} />
        <Field label="CVV" name="ccv" placeholder="123" inputMode="numeric" autoComplete="off" maxLength={4} format={value => value.replace(/\D/g, '').slice(0, 4)} />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {message && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </div>
      )}

      <button type="submit" disabled={loading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        Ativar Flowyn Pro por R$97/mes
      </button>
    </form>
  )
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue = '',
  placeholder,
  required = true,
  maxLength,
  inputMode,
  autoComplete,
  format,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
  maxLength?: number
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
  format?: (value: string) => string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={event => {
          if (format) event.currentTarget.value = format(event.currentTarget.value)
        }}
        className="h-12 w-full rounded-xl border-0 bg-surface px-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted focus:bg-card focus:ring-2 focus:ring-orange-500/20"
      />
    </label>
  )
}
