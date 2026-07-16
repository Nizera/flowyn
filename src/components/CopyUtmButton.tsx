'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyUtmButton({ productId }: { productId: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const utm = `utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&product_id=${productId}`
    navigator.clipboard.writeText(utm).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
      title="Copiar UTM para Meta Ads"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          Copiado!
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          UTM
        </>
      )}
    </button>
  )
}
