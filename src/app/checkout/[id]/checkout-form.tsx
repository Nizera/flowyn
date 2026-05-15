'use client'

import { useState, useEffect } from 'react'
import { Loader2, ShieldCheck, Mail, User as UserIcon } from 'lucide-react'

interface CheckoutFormProps {
  planId: string
  productId: string
  amount: number
  commissionRate: number
  affiliateId: string | null
  trackingId: string | null
  pixels: { platform: string; pixel_id: string }[]
  orderBump: {
    active: boolean
    title: string | null
    description: string | null
    price: number | null
    discountPercent: number | null
    imageUrl: string | null
  }
}

export function CheckoutForm({ planId, productId, amount, commissionRate, affiliateId, trackingId, pixels, orderBump }: CheckoutFormProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addOrderBump, setAddOrderBump] = useState(false)

  useEffect(() => {
    const el = document.getElementById('checkout-total-amount')
    if (el) {
      const basePrice = Number(el.getAttribute('data-base-price') || amount)
      let bumpPrice = 0
      if (addOrderBump && orderBump.price) {
        bumpPrice = orderBump.discountPercent && orderBump.discountPercent > 0
          ? Number(orderBump.price) * (1 - orderBump.discountPercent / 100)
          : Number(orderBump.price)
      }
      const total = basePrice + bumpPrice
      el.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`
    }
  }, [addOrderBump, amount, orderBump.price, orderBump.discountPercent])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const customerName = formData.get('customer_name') as string
    const customerEmail = formData.get('customer_email') as string

    if (!customerName || !customerEmail) {
      setError('Preencha todos os campos.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: planId,
          customer_name: customerName,
          customer_email: customerEmail,
          affiliate_id: affiliateId,
          tracking_id: trackingId,
          add_order_bump: addOrderBump,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao processar sua compra. Tente novamente.')
        setLoading(false)
        return
      }

      // Redirect to Stripe Checkout
      if (data.checkout_url) {
        // Fire pixel Purchase event before navigating away
        if (typeof window !== 'undefined' && (window as any).firePixelPurchase) {
          (window as any).firePixelPurchase(Number(amount))
        }
        window.location.href = data.checkout_url
        return // Don't setLoading(false) — we're navigating away
      }

      setSuccess(true)
    } catch (err) {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Compra Realizada! 🎉</h2>
        <p className="text-slate-500 mb-6">
          Sua assinatura foi processada com sucesso. Verifique seu e-mail para as instruções de acesso.
        </p>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">
          Em breve você receberá os dados de acesso no seu e-mail.
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="customer_name" className="block text-sm font-semibold text-slate-700 mb-2">
          Nome Completo
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <UserIcon className="w-5 h-5 text-slate-400" />
          </div>
          <input
            type="text"
            id="customer_name"
            name="customer_name"
            required
            placeholder="Seu nome completo"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="customer_email" className="block text-sm font-semibold text-slate-700 mb-2">
          E-mail
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Mail className="w-5 h-5 text-slate-400" />
          </div>
          <input
            type="email"
            id="customer_email"
            name="customer_email"
            required
            placeholder="seu@email.com"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {orderBump.active && orderBump.price && (
        <div className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${addOrderBump ? 'bg-primary/5 border-primary' : 'bg-slate-50 border-slate-200 border-dashed hover:border-primary/50'}`} onClick={() => setAddOrderBump(!addOrderBump)}>
          <div className="flex gap-3">
            <div className="pt-1">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${addOrderBump ? 'bg-primary border-primary' : 'bg-white border-slate-300'}`}>
                {addOrderBump && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
            </div>
            {orderBump.imageUrl && (
              <div className="shrink-0 pt-1">
                <img src={orderBump.imageUrl} alt="Order Bump" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded uppercase tracking-wider">Oferta Especial</span>
              </div>
              <h4 className="font-bold text-slate-900 leading-tight mb-1">{orderBump.title || 'Adicionar ao pedido'}</h4>
              <p className="text-sm text-slate-600 mb-2">{orderBump.description}</p>
              
              {orderBump.discountPercent && orderBump.discountPercent > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400 line-through">R$ {Number(orderBump.price).toFixed(2).replace('.', ',')}</span>
                  <span className="font-bold text-emerald-600">R$ {(Number(orderBump.price) * (1 - orderBump.discountPercent / 100)).toFixed(2).replace('.', ',')}</span>
                </div>
              ) : (
                <span className="font-bold text-emerald-600">R$ {Number(orderBump.price).toFixed(2).replace('.', ',')}</span>
              )}
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg mt-4"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            <ShieldCheck className="w-5 h-5" />
            Ir para Pagamento Seguro
          </>
        )}
      </button>

      <p className="text-center text-xs text-slate-400 mt-3">
        🔒 Seus dados estão protegidos com criptografia de ponta pelo Stripe.
      </p>
    </form>
  )
}
