'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck, Mail, User as UserIcon } from 'lucide-react'

interface CheckoutFormProps {
  planId: string
  productId: string
  amount: number
  commissionRate: number
  affiliateId: string | null
  trackingId: string | null
  pixels: { platform: string; pixel_id: string }[]
}

export function CheckoutForm({ planId, productId, amount, commissionRate, affiliateId, trackingId, pixels }: CheckoutFormProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const customerName = formData.get('customer_name') as string
    const customerEmail = formData.get('customer_email') as string
    const customerCpfCnpj = formData.get('customer_cpfCnpj') as string

    if (!customerName || !customerEmail || !customerCpfCnpj) {
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
          customer_cpfCnpj: customerCpfCnpj,
          affiliate_id: affiliateId,
          tracking_id: trackingId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao processar sua compra. Tente novamente.')
        setLoading(false)
        return
      }

      // Redirect to Asaas Checkout
      if (data.checkout_url) {
        // Fire pixel Purchase event before navigating away
        window.firePixelPurchase?.(Number(amount))
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
        <label htmlFor="customer_cpfCnpj" className="block text-sm font-semibold text-slate-700 mb-2">
          CPF ou CNPJ
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <ShieldCheck className="w-5 h-5 text-slate-400" />
          </div>
          <input
            type="text"
            id="customer_cpfCnpj"
            name="customer_cpfCnpj"
            required
            placeholder="000.000.000-00"
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
            Finalizar Compra
          </>
        )}
      </button>

      <p className="text-center text-xs text-slate-400 mt-3">
        🔒 Seus dados estão protegidos com criptografia de ponta.
      </p>
    </form>
  )
}
