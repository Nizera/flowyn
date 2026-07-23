'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const CONSENT_KEY = 'flowyn_cookie_consent'

export default function CookieConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY)
    if (!consent) setShow(true)
  }, [])

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setShow(false)
  }

  function reject() {
    localStorage.setItem(CONSENT_KEY, 'rejected')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 md:p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#101412]/95 backdrop-blur-xl p-5 shadow-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-white mb-1">Cookies e Privacidade</p>
            <p className="text-xs text-white/50 leading-relaxed">
              Utilizamos cookies essenciais para o funcionamento da plataforma e cookies de rastreamento
              (Meta Pixel, Google Ads) para medir o desempenho de anúncios. Ao continuar navegando,
              você concorda com o uso de cookies.{' '}
              <Link href="/privacy" className="text-[#f97316] hover:underline">
                Política de Privacidade
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={reject}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-white/60 transition hover:text-white"
            >
              Rejeitar
            </button>
            <button
              onClick={accept}
              className="rounded-lg bg-[#f97316] px-4 py-2 text-xs font-semibold text-[#070908] transition hover:bg-[#fb923c]"
            >
              Aceitar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
