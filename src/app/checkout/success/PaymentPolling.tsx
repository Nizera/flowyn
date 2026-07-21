'use client'

import { Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'

const POLL_INTERVAL_MS = 5_000
const MAX_POLL_ATTEMPTS = 60

export function PaymentPolling({ orderId }: { orderId: string }) {
  const [attempts, setAttempts] = useState(0)
  const [error, setError] = useState(false)

  const check = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkout/status?order_id=${orderId}`)
      const data = await res.json()

      if (data.paid) {
        window.location.reload()
        return
      }

      if (data.failed) {
        setError(true)
        return
      }

      setAttempts(prev => {
        const next = prev + 1
        if (next >= MAX_POLL_ATTEMPTS) {
          setError(true)
        }
        return next
      })
    } catch {
      setAttempts(prev => prev + 1)
    }
  }, [orderId])

  useEffect(() => {
    if (error) return

    const timer = setTimeout(check, POLL_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [attempts, error, check])

  if (error) {
    return (
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
        <p className="text-sm font-semibold text-amber-800">Pagamento ainda nao confirmado</p>
        <p className="mt-1 text-xs text-amber-600">
          Se voce ja pagou, o pagamento pode levar alguns minutos para ser processado.
          Voce pode verificar o status na pagina de pedidos ou aguardar a confirmacao por e-mail.
        </p>
        <button
          onClick={() => { setError(false); setAttempts(0) }}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 underline"
        >
          <RefreshCw className="h-3 w-3" />
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Verificando pagamento...</span>
    </div>
  )
}
