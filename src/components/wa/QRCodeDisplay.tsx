'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Smartphone, QrCode, Loader2, CheckCircle2, XCircle } from 'lucide-react'

interface QRCodeDisplayProps {
  sessionId: string
  onPair: () => Promise<void>
  onRefresh?: () => void
  status: 'idle' | 'loading' | 'qr_ready' | 'paired' | 'error'
  qrData?: string
  error?: string
  attempt?: number
  maxAttempts?: number
}

export function QRCodeDisplay({
  sessionId,
  onPair,
  onRefresh,
  status,
  qrData,
  error,
  attempt = 0,
  maxAttempts = 30,
}: QRCodeDisplayProps) {
  const [countdown, setCountdown] = useState(30)

  useEffect(() => {
    if (status !== 'qr_ready') return

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRefresh?.()
          return 30
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [status, onRefresh])

  useEffect(() => {
    if (status === 'qr_ready') {
      setCountdown(30)
    }
  }, [status])

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-zinc-900 rounded-xl border border-zinc-800">
      {status === 'idle' && (
        <>
          <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <QrCode className="w-10 h-10 text-zinc-400" />
          </div>
          <h3 className="text-lg font-medium text-zinc-100 mb-2">
            Conectar WhatsApp
          </h3>
          <p className="text-sm text-zinc-400 text-center mb-6 max-w-sm">
            Clique no botão abaixo para gerar o QR Code e conectar seu WhatsApp
          </p>
          <button
            onClick={onPair}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
          >
            <Smartphone className="w-5 h-5" />
            Gerar QR Code
          </button>
        </>
      )}

      {status === 'loading' && (
        <>
          <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mb-4" />
          <h3 className="text-lg font-medium text-zinc-100 mb-2">
            Gerando QR Code...
          </h3>
          <p className="text-sm text-zinc-400 text-center">
            Aguarde um momento
          </p>
        </>
      )}

      {status === 'qr_ready' && qrData && (
        <>
          <div className="relative mb-4">
            <img
              src={
                qrData.startsWith('data:') || qrData.startsWith('http')
                  ? qrData
                  : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`
              }
              alt="QR Code WhatsApp"
              className="w-64 h-64 rounded-lg bg-white p-2"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/5 rounded-lg">
              <Loader2 className="w-8 h-8 text-zinc-400 animate-spin opacity-50" />
            </div>
          </div>

          <div className="text-center mb-4">
            <h3 className="text-lg font-medium text-zinc-100 mb-2">
              Escaneie o QR Code
            </h3>
            <p className="text-sm text-zinc-400 text-center max-w-sm">
              Abra o WhatsApp no seu celular, vá em{' '}
              <span className="text-zinc-300">Aparelhos conectados</span> e
              escaneie o código
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <RefreshCw className="w-4 h-4" />
            <span>Atualiza em {countdown}s</span>
          </div>

          {attempt > 0 && (
            <p className="text-xs text-zinc-500 mt-2">
              Tentativa {attempt} de {maxAttempts}
            </p>
          )}
        </>
      )}

      {status === 'paired' && (
        <>
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="text-lg font-medium text-zinc-100 mb-2">
            Conectado!
          </h3>
          <p className="text-sm text-zinc-400 text-center">
            Seu WhatsApp foi conectado com sucesso
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-lg font-medium text-zinc-100 mb-2">
            Erro ao conectar
          </h3>
          <p className="text-sm text-red-400 text-center mb-4">
            {error || 'Não foi possível conectar ao WhatsApp'}
          </p>
          <button
            onClick={onPair}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
        </>
      )}
    </div>
  )
}
