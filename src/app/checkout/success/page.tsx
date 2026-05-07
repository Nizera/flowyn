'use client'

import { useSearchParams } from 'next/navigation'
import { ShieldCheck, ArrowRight, Mail } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

function SuccessContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order_id')

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <ShieldCheck className="w-10 h-10 text-emerald-600" />
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          Compra Confirmada! 🎉
        </h1>

        <p className="text-slate-500 mb-6 leading-relaxed">
          Seu pagamento foi processado com sucesso pelo Asaas. Você receberá os dados de acesso no seu e-mail em instantes.
        </p>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3 text-emerald-700">
            <Mail className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium text-left">
              Verifique sua caixa de entrada (e spam) para as instruções de acesso à plataforma.
            </p>
          </div>
        </div>

        {orderId && (
          <p className="text-xs text-slate-400 mb-6">
            ID do pedido: <span className="font-mono">{orderId.slice(0, 8)}...</span>
          </p>
        )}

        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-6 rounded-xl transition-all"
        >
          Voltar ao Início
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
