'use client'

import { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'

export function ResendDeliveryButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [customerEmail, setCustomerEmail] = useState('')

  async function handleResend() {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/checkout/resend-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, customer_email: customerEmail }),
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
      <input
        type="email"
        value={customerEmail}
        onChange={(event) => setCustomerEmail(event.target.value)}
        placeholder="E-mail usado na compra"
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground outline-none transition placeholder:text-muted focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
      />
      <button
        type="button"
        onClick={handleResend}
        disabled={loading || !customerEmail}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-bold text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {loading ? 'Reenviando...' : 'Reenviar e-mail'}
      </button>
      {message && <p className="text-sm font-medium text-muted">{message}</p>}
    </div>
  )
}
