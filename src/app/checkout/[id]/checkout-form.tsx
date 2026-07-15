'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CreditCard, Loader2, Lock, Mail, MapPin, Phone, Search, ShieldCheck, User as UserIcon, QrCode } from 'lucide-react'
import { formatCardNumber, formatCpfCnpj, formatPhone, formatPostalCode, lookupPostalCode, type CepAddress } from '@/lib/brazil-fields'

interface OrderBumpData {
  active: boolean
  title: string | null
  description: string | null
  price: number | null
  imageUrl: string | null
}

interface CheckoutFormProps {
  planId: string
  productId: string
  amount: number
  pixels: { platform: string; pixel_id: string }[]
  orderBump: OrderBumpData
  primaryColor?: string
  buttonText?: string
  previewMode?: boolean
  recurring?: boolean
}

function money(value: number) {
  return value.toFixed(2).replace('.', ',')
}

function digits(value: string) {
  return value.replace(/\D/g, '')
}

export function CheckoutForm({
  planId,
  amount,
  orderBump,
  primaryColor = '#059669',
  buttonText = 'Pagar',
  previewMode = false,
  recurring = false,
}: CheckoutFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix'>(recurring ? 'credit_card' : 'pix')
  const [addOrderBump, setAddOrderBump] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pixQrCode, setPixQrCode] = useState<string | null>(null)
  const [pixKey, setPixKey] = useState<string | null>(null)
  const [pixPaymentId, setPixPaymentId] = useState<string | null>(null)
  const [pixInvoiceUrl, setPixInvoiceUrl] = useState<string | null>(null)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string | null>(null)
  const statusCheckInFlight = useRef(false)

  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerDocument, setCustomerDocument] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  const [cardHolderName, setCardHolderName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiryMonth, setExpiryMonth] = useState('')
  const [expiryYear, setExpiryYear] = useState('')
  const [ccv, setCcv] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [addressNumber, setAddressNumber] = useState('')
  const [addressComplement, setAddressComplement] = useState('')
  const [postalCodeAddress, setPostalCodeAddress] = useState<CepAddress | null>(null)
  const [postalCodeError, setPostalCodeError] = useState<string | null>(null)
  const [searchingPostalCode, setSearchingPostalCode] = useState(false)
  const [trackingParams, setTrackingParams] = useState<Record<string, string> | undefined>(undefined)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result: Record<string, string> = {}
    const knownParams = [
      'utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term',
      'src', 'sck', 'gclid', 'fbclid', 'ttclid',
    ]

    let hasUrlParams = false
    for (const key of knownParams) {
      const val = params.get(key)
      if (val) {
        result[key] = val
        hasUrlParams = true
      }
    }

    if (hasUrlParams) {
      try { sessionStorage.setItem('flowyn_tracking', JSON.stringify(result)) } catch {}
    } else {
      try {
        const stored = sessionStorage.getItem('flowyn_tracking')
        if (stored) Object.assign(result, JSON.parse(stored))
      } catch {}
    }

    const cookies = document.cookie.split('; ')
    for (const c of cookies) {
      const [k, v] = c.split('=', 2) as [string, string | undefined]
      if ((k === '_fbp' || k === '_fbc') && v) result[k] = v
    }
    setTrackingParams(Object.keys(result).length > 0 ? result : undefined)
  }, [])

  async function searchPostalCode() {
    if (digits(postalCode).length !== 8) {
      setPostalCodeAddress(null)
      setPostalCodeError('Digite os 8 números do CEP.')
      return
    }
    setSearchingPostalCode(true)
    setPostalCodeError(null)
    try {
      setPostalCodeAddress(await lookupPostalCode(postalCode))
    } catch (lookupError) {
      setPostalCodeAddress(null)
      setPostalCodeError(lookupError instanceof Error ? lookupError.message : 'CEP não encontrado.')
    } finally {
      setSearchingPostalCode(false)
    }
  }

  const bumpPrice = useMemo(() => {
    if (!addOrderBump || !orderBump.price) return 0
    return Number(orderBump.price)
  }, [addOrderBump, orderBump.price])

  const totalAmount = amount + bumpPrice

  useEffect(() => {
    const el = document.getElementById('checkout-total-amount')
    if (el) el.innerText = `R$ ${money(totalAmount)}`
  }, [totalAmount])

  const checkPixPayment = useCallback(async (showPendingMessage = false) => {
    if (!pixPaymentId || statusCheckInFlight.current) return

    statusCheckInFlight.current = true
    setCheckingPayment(true)

    try {
      const response = await fetch(`/api/checkout/status?order_id=${encodeURIComponent(pixPaymentId)}`, {
        cache: 'no-store',
      })
      const data = await response.json()

      if (!response.ok) {
        if (showPendingMessage) setPaymentStatusMessage(data.error || 'Nao foi possivel verificar o pagamento agora.')
        return
      }

      if (data.paid) {
        setPaymentStatusMessage('Pagamento confirmado! Redirecionando...')
        window.firePixelPurchase?.(totalAmount, `order_${pixPaymentId}`)
        await new Promise(r => setTimeout(r, 500))
        window.location.href = `/checkout/success?order_id=${pixPaymentId}`
        return
      }

      if (data.failed) {
        setPaymentStatusMessage('O pagamento nao foi concluido. Gere uma nova cobranca ou escolha outra forma de pagamento.')
      } else if (showPendingMessage) {
        setPaymentStatusMessage('Pagamento ainda aguardando confirmacao do Asaas.')
      }
    } catch {
      if (showPendingMessage) setPaymentStatusMessage('Falha ao consultar o pagamento. Tente novamente em instantes.')
    } finally {
      statusCheckInFlight.current = false
      setCheckingPayment(false)
    }
  }, [pixPaymentId])

  useEffect(() => {
    if (!pixPaymentId) return

    const initialCheck = window.setTimeout(() => void checkPixPayment(), 0)
    const interval = window.setInterval(() => void checkPixPayment(), 4000)
    return () => {
      window.clearTimeout(initialCheck)
      window.clearInterval(interval)
    }
  }, [checkPixPayment, pixPaymentId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (previewMode) {
      setError('Preview do checkout: nenhum pagamento sera processado.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        plan_id: planId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_document: customerDocument,
        customer_phone: customerPhone,
        add_order_bump: addOrderBump,
        billing_type: paymentMethod === 'pix' ? 'PIX' : 'CREDIT_CARD',
        tracking_params: trackingParams,
      }

      if (paymentMethod === 'credit_card') {
        body.card = {
          holderName: cardHolderName || customerName,
          number: cardNumber,
          expiryMonth,
          expiryYear,
          ccv,
        }
        body.holder = {
          name: cardHolderName || customerName,
          email: customerEmail,
          cpfCnpj: customerDocument,
          postalCode,
          addressNumber,
          addressComplement,
          mobilePhone: customerPhone,
        }
      }

      const res = await fetch('/api/checkout/asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao processar pagamento.')
        return
      }

      if (paymentMethod === 'pix') {
        const qrCode = data.pixQrCode || null
        const invoiceUrl = data.invoice_url || null

        setPixQrCode(qrCode)
        setPixKey(data.pixKey || null)
        setPixPaymentId(data.order_id || null)
        setPixInvoiceUrl(invoiceUrl)
        if (!qrCode && !invoiceUrl) {
          setError('A cobranca Pix foi criada, mas o QR Code ainda nao ficou disponivel. Tente novamente em instantes.')
        }
        setLoading(false)
        return
      }

      if (!data.success) {
        setError(data.error || 'Pagamento nao aprovado. Confira os dados e tente novamente.')
        return
      }

      window.firePixelPurchase?.(totalAmount, `order_${data.order_id}`)
      await new Promise(r => setTimeout(r, 500))
      window.location.href = `/checkout/success?order_id=${data.order_id}`
    } catch {
      setError('Erro de conexao. Verifique sua internet e tente novamente.')
    } finally {
      if (paymentMethod === 'credit_card') {
        setCardNumber('')
        setExpiryMonth('')
        setExpiryYear('')
        setCcv('')
      }
      setLoading(false)
    }
  }

  const inputClass =
    'w-full bg-white border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 placeholder:text-slate-400 focus:ring-2 transition-all outline-none'
  const plainInputClass =
    'w-full bg-white border border-slate-200 rounded-xl py-3.5 px-4 text-slate-900 placeholder:text-slate-400 focus:ring-2 outline-none'
  const focusStyle = {
    '--tw-ring-color': `${primaryColor}26`,
  } as React.CSSProperties

  if (pixQrCode) {
    return (
      <div className="space-y-6 text-center">
        <div className="rounded-2xl bg-slate-50 p-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${primaryColor}15` }}>
            <QrCode className="h-7 w-7" style={{ color: primaryColor }} />
          </div>
          <h3 className="text-lg font-black text-slate-900">Pagamento via PIX</h3>
          <p className="mt-1 text-sm text-slate-500">Escaneie o QR Code abaixo com o app do seu banco para pagar.</p>
        </div>

        <div className="flex justify-center">
          <img src={`data:image/png;base64,${pixQrCode}`} alt="PIX QR Code" className="h-64 w-64 rounded-2xl border border-slate-200" />
        </div>

        {pixKey && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold text-slate-500">Ou copie o codigo PIX:</p>
            <div className="flex gap-2">
              <input readOnly value={pixKey} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700" />
              <button
                onClick={() => navigator.clipboard.writeText(pixKey)}
                className="rounded-xl px-4 py-3 text-sm font-bold text-white transition"
                style={{ backgroundColor: primaryColor }}
              >
                Copiar
              </button>
            </div>
          </div>
        )}

        <p className="text-sm text-slate-400">
          Apos o pagamento, a confirmacao pode levar alguns segundos.
        </p>

        {paymentStatusMessage && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            {paymentStatusMessage}
          </p>
        )}

        <button
          type="button"
          onClick={() => void checkPixPayment(true)}
          disabled={checkingPayment}
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition"
          style={{ backgroundColor: primaryColor }}
        >
          {checkingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {checkingPayment ? 'Verificando...' : 'Ja paguei'}
        </button>
      </div>
    )
  }

  if (pixPaymentId) {
    return (
      <div className="space-y-6 text-center">
        <div className="rounded-2xl bg-slate-50 p-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${primaryColor}15` }}>
            <QrCode className="h-7 w-7" style={{ color: primaryColor }} />
          </div>
          <h3 className="text-lg font-black text-slate-900">Pagamento via PIX</h3>
          <p className="mt-1 text-sm text-slate-500">Pedido criado com sucesso! Finalize o pagamento no ambiente do Asaas.</p>
        </div>

        {pixInvoiceUrl ? (
          <a
            href={pixInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition"
            style={{ backgroundColor: primaryColor }}
          >
            Pagar no Asaas
            <ArrowRight className="h-4 w-4" />
          </a>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            O QR Code ainda nao ficou disponivel. Aguarde alguns instantes antes de tentar novamente.
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
      {/* Payment method toggle */}
      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
        <button
          type="button"
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${
            paymentMethod === 'credit_card' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setPaymentMethod('credit_card')}
        >
          <CreditCard className="h-4 w-4" />
          Cartao
        </button>
        <button
          type="button"
          disabled={recurring}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${
            recurring ? 'cursor-not-allowed opacity-40' : paymentMethod === 'pix' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => { if (!recurring) setPaymentMethod('pix') }}
        >
          <QrCode className="h-4 w-4" />
          PIX
        </button>
      </div>

      {recurring && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
          Para assinaturas mensais, o pagamento via PIX requer o Pix Automatico, que ainda nao esta disponivel. Utilize cartao de credito para assinar.
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="customer_name" className="mb-2 block text-sm font-semibold text-slate-700">
            Nome completo
          </label>
          <div className="relative">
            <UserIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="customer_name"
              required
              value={customerName}
              onChange={e => {
                setCustomerName(e.target.value)
                if (!cardHolderName) setCardHolderName(e.target.value)
              }}
              placeholder="Seu nome completo"
              className={inputClass}
              style={focusStyle}
            />
          </div>
        </div>

        <div>
          <label htmlFor="customer_email" className="mb-2 block text-sm font-semibold text-slate-700">
            E-mail
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="customer_email"
              type="email"
              required
              value={customerEmail}
              onChange={e => setCustomerEmail(e.target.value)}
              placeholder="seu@email.com"
              className={inputClass}
              style={focusStyle}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="customer_document" className="mb-2 block text-sm font-semibold text-slate-700">
              CPF/CNPJ
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="customer_document"
                required
                value={customerDocument}
                onChange={e => setCustomerDocument(formatCpfCnpj(e.target.value))}
                inputMode="numeric"
                maxLength={18}
                placeholder="000.000.000-00"
                className={inputClass}
                style={focusStyle}
              />
            </div>
          </div>

          <div>
            <label htmlFor="customer_phone" className="mb-2 block text-sm font-semibold text-slate-700">
              Celular
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="customer_phone"
                required
                value={customerPhone}
                onChange={e => setCustomerPhone(formatPhone(e.target.value))}
                inputMode="tel"
                maxLength={15}
                placeholder="(11) 99999-9999"
                className={inputClass}
                style={focusStyle}
              />
            </div>
          </div>
        </div>
      </div>

      {orderBump.active && orderBump.price && (
        <button
          type="button"
          className="w-full rounded-2xl border-2 p-4 text-left transition-all"
          style={{
            backgroundColor: addOrderBump ? `${primaryColor}10` : '#f8fafc',
            borderColor: addOrderBump ? primaryColor : '#e2e8f0',
            borderStyle: addOrderBump ? 'solid' : 'dashed',
          }}
          onClick={() => setAddOrderBump(!addOrderBump)}
        >
          <div className="flex gap-3">
            <div
              className="mt-1 flex h-5 w-5 items-center justify-center rounded border"
              style={{
                backgroundColor: addOrderBump ? primaryColor : '#ffffff',
                borderColor: addOrderBump ? primaryColor : '#cbd5e1',
              }}
            >
              {addOrderBump && <span className="text-xs font-bold text-white">✓</span>}
            </div>
            {orderBump.imageUrl && (
              <img src={orderBump.imageUrl} alt="Order bump" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
            )}
            <div className="flex-1">
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-red-700">
                Oferta especial
              </span>
              <h4 className="mt-2 font-bold leading-tight text-slate-900">{orderBump.title || 'Adicionar ao pedido'}</h4>
              <p className="mt-1 text-sm text-slate-600">{orderBump.description}</p>
              <p className="mt-2 font-bold" style={{ color: primaryColor }}>
                R$ {money(bumpPrice || Number(orderBump.price))}
              </p>
            </div>
          </div>
        </button>
      )}

      {paymentMethod === 'credit_card' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <CreditCard className="h-5 w-5" style={{ color: primaryColor }} />
            Cartao de credito
          </div>

          <div>
            <label htmlFor="card_holder" className="mb-2 block text-sm font-semibold text-slate-700">
              Nome impresso no cartao
            </label>
            <input
              id="card_holder"
              required
              value={cardHolderName}
              onChange={e => setCardHolderName(e.target.value)}
              placeholder="Como aparece no cartao"
              className={plainInputClass}
              style={focusStyle}
            />
          </div>

          <div>
            <label htmlFor="card_number" className="mb-2 block text-sm font-semibold text-slate-700">
              Numero do cartao
            </label>
            <input
              id="card_number"
              required
              inputMode="numeric"
              autoComplete="off"
              value={cardNumber}
              onChange={e => setCardNumber(formatCardNumber(e.target.value))}
              maxLength={23}
              placeholder="0000 0000 0000 0000"
              className={plainInputClass}
              style={focusStyle}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <input required inputMode="numeric" autoComplete="off" value={expiryMonth} onChange={e => setExpiryMonth(digits(e.target.value).slice(0, 2))} placeholder="MM" className={plainInputClass} style={focusStyle} />
            <input required inputMode="numeric" autoComplete="off" value={expiryYear} onChange={e => setExpiryYear(digits(e.target.value).slice(0, 4))} placeholder="AAAA" className={plainInputClass} style={focusStyle} />
            <input required inputMode="numeric" autoComplete="off" value={ccv} onChange={e => setCcv(digits(e.target.value).slice(0, 4))} placeholder="CVV" className={plainInputClass} style={focusStyle} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="postal_code" className="mb-2 block text-sm font-semibold text-slate-700">
                CEP do titular
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="postal_code"
                  required
                  inputMode="numeric"
                  autoComplete="postal-code"
                  minLength={9}
                  maxLength={9}
                  value={postalCode}
                  onChange={e => {
                    setPostalCode(formatPostalCode(e.target.value))
                    setPostalCodeAddress(null)
                    setPostalCodeError(null)
                  }}
                  onBlur={() => {
                    if (digits(postalCode).length === 8 && !postalCodeAddress) void searchPostalCode()
                  }}
                  placeholder="00000-000"
                  className={`${inputClass} pr-12`}
                  style={focusStyle}
                />
                <button type="button" aria-label="Buscar CEP" onClick={() => void searchPostalCode()} disabled={searchingPostalCode || digits(postalCode).length !== 8} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
                  {searchingPostalCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>
              {postalCodeError && <p className="mt-2 text-xs font-medium text-red-600">{postalCodeError}</p>}
            </div>
            <div>
              <label htmlFor="address_number" className="mb-2 block text-sm font-semibold text-slate-700">
                Numero
              </label>
              <input id="address_number" required inputMode="numeric" maxLength={10} value={addressNumber} onChange={e => setAddressNumber(digits(e.target.value).slice(0, 10))} placeholder="123" className={plainInputClass} style={focusStyle} />
            </div>
          </div>

          {postalCodeAddress && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{[postalCodeAddress.street, postalCodeAddress.neighborhood, `${postalCodeAddress.city} - ${postalCodeAddress.state}`].filter(Boolean).join(', ')}</span>
            </div>
          )}

          <input value={addressComplement} onChange={e => setAddressComplement(e.target.value)} placeholder="Complemento (opcional)" className={plainInputClass} style={focusStyle} />
        </div>
      )}

      {paymentMethod === 'pix' && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <QrCode className="h-5 w-5" style={{ color: primaryColor }} />
            Pagamento via PIX
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Apos finalizar, um QR Code PIX sera gerado para voce pagar diretamente pelo app do seu banco. A confirmacao e instantanea.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{ backgroundColor: primaryColor }}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-lg font-bold text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            <Lock className="h-5 w-5" />
            {paymentMethod === 'pix' ? 'Gerar QR Code PIX' : `${buttonText} R$ ${money(totalAmount)}`}
          </>
        )}
      </button>

      <p className="text-center text-xs text-slate-400">
        Pagamento processado pela Asaas. Os dados do cartao nao sao enviados para a Flowyn.
      </p>
    </form>
  )
}
