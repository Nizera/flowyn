'use client'

import { useState } from 'react'
import { Copy, Check, Clock, Download, ExternalLink } from 'lucide-react'

interface PixPaymentProps {
  pixQrCode: string
  pixCopyPaste: string
  value: number
  expirationDate?: string
  invoiceUrl?: string
  onCopy?: () => void
}

export function PixPayment({
  pixQrCode,
  pixCopyPaste,
  value,
  expirationDate,
  invoiceUrl,
  onCopy,
}: PixPaymentProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pixCopyPaste)
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textArea = document.createElement('textarea')
      textArea.value = pixCopyPaste
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatValue = (v: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(v)
  }

  return (
    <div className="bg-zinc-800 rounded-xl border border-zinc-700 overflow-hidden max-w-[320px]">
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">PIX Copia e Cola</span>
          <span className="text-lg font-bold text-white">{formatValue(value)}</span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex justify-center mb-4">
          <img
            src={`data:image/png;base64,${pixQrCode}`}
            alt="QR Code PIX"
            className="w-48 h-48 rounded-lg bg-white p-2"
          />
        </div>

        <div className="space-y-3">
          <button
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copiar Código PIX
              </>
            )}
          </button>

          {invoiceUrl && (
            <a
              href={invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Ver boleto
            </a>
          )}

          {expirationDate && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-500">
              <Clock className="w-3 h-3" />
              Expira em {new Date(expirationDate).toLocaleString('pt-BR')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
