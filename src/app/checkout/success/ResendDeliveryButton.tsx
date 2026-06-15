'use client'

import { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'

export function ResendDeliveryButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleResend() {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/checkout/resend-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      })
      const data = await response.json()
      setMessage(response.ok ? 'E-mail reenviado. Verifique também a caixa de spam.' : data.error || 'Nao foi possivel reenviar.')
    } catch {
      setMessage('Nao foi possivel reenviar. Tente novamente em instantes.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleResend}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {loading ? 'Reenviando...' : 'Reenviar e-mail'}
      </button>
      {message && <p className="text-sm font-medium text-slate-600">{message}</p>}
    </div>
  )
}
