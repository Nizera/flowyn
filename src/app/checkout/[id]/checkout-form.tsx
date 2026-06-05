'use client'

import { useEffect, useMemo, useState } from 'react'
import { CreditCard, Loader2, Lock, Mail, MapPin, Phone, ShieldCheck, User as UserIcon } from 'lucide-react'

interface OrderBumpData {
  active: boolean
  title: string | null
  description: string | null
  price: number | null
  discountPercent: number | null
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
}: CheckoutFormProps) {
  const [addOrderBump, setAddOrderBump] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const bumpPrice = useMemo(() => {
    if (!addOrderBump || !orderBump.price) return 0
    const rawPrice = Number(orderBump.price)
    const discount = Number(orderBump.discountPercent || 0)
    return discount > 0 ? rawPrice * (1 - discount / 100) : rawPrice
  }, [addOrderBump, orderBump.discountPercent, orderBump.price])

  const totalAmount = amount + bumpPrice

  useEffect(() => {
    const el = document.getElementById('checkout-total-amount')
    if (el) el.innerText = `R$ ${money(totalAmount)}`
  }, [totalAmount])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (previewMode) {
      setError('Preview do checkout: nenhum pagamento sera processado.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/checkout/asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: planId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_document: customerDocument,
          customer_phone: customerPhone,
          add_order_bump: addOrderBump,
          card: {
            holderName: cardHolderName || customerName,
            number: cardNumber,
            expiryMonth,
            expiryYear,
            ccv,
          },
          holder: {
            name: cardHolderName || customerName,
            email: customerEmail,
            cpfCnpj: customerDocument,
            postalCode,
            addressNumber,
            addressComplement,
            mobilePhone: customerPhone,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Pagamento não aprovado. Confira os dados e tente novamente.')
        return
      }

      window.location.href = `/checkout/success?order_id=${data.order_id}`
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="customer_name" className="block text-sm font-semibold text-slate-700 mb-2">
            Nome completo
          </label>
          <div className="relative">
            <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
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
          <label htmlFor="customer_email" className="block text-sm font-semibold text-slate-700 mb-2">
            E-mail
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="customer_document" className="block text-sm font-semibold text-slate-700 mb-2">
              CPF/CNPJ
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="customer_document"
                required
                value={customerDocument}
                onChange={e => setCustomerDocument(digits(e.target.value))}
                placeholder="Somente números"
                className={inputClass}
                style={focusStyle}
              />
            </div>
          </div>

          <div>
            <label htmlFor="customer_phone" className="block text-sm font-semibold text-slate-700 mb-2">
              Celular
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="customer_phone"
                required
                value={customerPhone}
                onChange={e => setCustomerPhone(digits(e.target.value))}
                placeholder="DDD + número"
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
              {addOrderBump && <span className="text-white text-xs font-bold">✓</span>}
            </div>
            {orderBump.imageUrl && (
              <img src={orderBump.imageUrl} alt="Order bump" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
            )}
            <div className="flex-1">
              <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded uppercase tracking-wider">
                Oferta especial
              </span>
              <h4 className="font-bold text-slate-900 leading-tight mt-2">{orderBump.title || 'Adicionar ao pedido'}</h4>
              <p className="text-sm text-slate-600 mt-1">{orderBump.description}</p>
              <p className="mt-2 font-bold" style={{ color: primaryColor }}>R$ {money(bumpPrice || Number(orderBump.price))}</p>
            </div>
          </div>
        </button>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold">
          <CreditCard className="w-5 h-5" style={{ color: primaryColor }} />
          Cartão de crédito
        </div>

        <div>
          <label htmlFor="card_holder" className="block text-sm font-semibold text-slate-700 mb-2">
            Nome impresso no cartão
          </label>
          <input
            id="card_holder"
            required
            value={cardHolderName}
            onChange={e => setCardHolderName(e.target.value)}
            placeholder="Como aparece no cartão"
            className={plainInputClass}
            style={focusStyle}
          />
        </div>

        <div>
          <label htmlFor="card_number" className="block text-sm font-semibold text-slate-700 mb-2">
            Número do cartão
          </label>
          <input
            id="card_number"
            required
            inputMode="numeric"
            autoComplete="cc-number"
            value={cardNumber}
            onChange={e => setCardNumber(digits(e.target.value).slice(0, 19))}
            placeholder="0000 0000 0000 0000"
            className={plainInputClass}
            style={focusStyle}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <input required inputMode="numeric" autoComplete="cc-exp-month" value={expiryMonth} onChange={e => setExpiryMonth(digits(e.target.value).slice(0, 2))} placeholder="MM" className={plainInputClass} style={focusStyle} />
          <input required inputMode="numeric" autoComplete="cc-exp-year" value={expiryYear} onChange={e => setExpiryYear(digits(e.target.value).slice(0, 4))} placeholder="AAAA" className={plainInputClass} style={focusStyle} />
          <input required inputMode="numeric" autoComplete="cc-csc" value={ccv} onChange={e => setCcv(digits(e.target.value).slice(0, 4))} placeholder="CVV" className={plainInputClass} style={focusStyle} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="postal_code" className="block text-sm font-semibold text-slate-700 mb-2">
              CEP do titular
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input id="postal_code" required value={postalCode} onChange={e => setPostalCode(digits(e.target.value).slice(0, 8))} placeholder="00000000" className={inputClass} style={focusStyle} />
            </div>
          </div>
          <div>
            <label htmlFor="address_number" className="block text-sm font-semibold text-slate-700 mb-2">
              Número
            </label>
            <input id="address_number" required value={addressNumber} onChange={e => setAddressNumber(e.target.value)} placeholder="123" className={plainInputClass} style={focusStyle} />
          </div>
        </div>

        <input value={addressComplement} onChange={e => setAddressComplement(e.target.value)} placeholder="Complemento (opcional)" className={plainInputClass} style={focusStyle} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{ backgroundColor: primaryColor }}
        className="w-full text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            <Lock className="w-5 h-5" />
            {buttonText} R$ {money(totalAmount)}
          </>
        )}
      </button>

      <p className="text-center text-xs text-slate-400">
        Pagamento protegido pela Asaas. Os dados do cartão não são armazenados pela Flowyn.
      </p>
    </form>
  )
}
