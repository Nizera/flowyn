'use client'

import { useState } from 'react'
import { Copy, Check, X, ExternalLink } from 'lucide-react'

export function CopyUtmButton({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const utm = `utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&product_id=${productId}`

  function handleCopy() {
    navigator.clipboard.writeText(utm).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-black text-muted transition hover:border-orange-200 hover:bg-surface hover:text-primary"
        title="Configurar UTM para Meta Ads"
      >
        <Copy className="h-3.5 w-3.5" />
        UTM
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-foreground">Configurar UTM no Meta Ads</h3>
                <p className="text-xs text-muted mt-1">Copie e cole nos parâmetros de URL do seu criativo</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-surface text-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* UTM String */}
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Seu UTM</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-surface border border-border rounded-lg px-3 py-2.5 text-xs text-foreground break-all font-mono">
                    {utm}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-orange-500 text-white px-4 py-2.5 text-xs font-bold transition hover:bg-orange-600"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              {/* Passo a passo */}
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-3 block">Passo a passo</label>
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">1</span>
                    <div>
                      <p className="text-sm font-bold text-foreground">Abra o Meta Ads Manager</p>
                      <p className="text-xs text-muted">Acesse <a href="https://adsmanager.facebook.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline inline-flex items-center gap-0.5">adsmanager.facebook.com <ExternalLink className="h-3 w-3" /></a></p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">2</span>
                    <div>
                      <p className="text-sm font-bold text-foreground">Edite ou crie um anúncio</p>
                      <p className="text-xs text-muted">Vá até o nível <strong>Anúncio</strong> (não Campanha)</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">3</span>
                    <div>
                      <p className="text-sm font-bold text-foreground">Rolar até &quot;Opções de Rastreamento&quot;</p>
                      <p className="text-xs text-muted">Procure por <strong>URL Parameters</strong> ou <strong>Parâmetros de URL</strong></p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">4</span>
                    <div>
                      <p className="text-sm font-bold text-foreground">Cole o UTM copiado</p>
                      <p className="text-xs text-muted">Cole o texto copiado no campo e salve</p>
                    </div>
                  </li>
                </ol>
              </div>

              {/* Preview */}
              <div className="bg-surface rounded-xl p-4 border border-border">
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Como vai ficar na URL</label>
                <p className="text-xs text-muted leading-relaxed">
                  Quando alguém clicar no seu anúncio, a URL terá os UTMs automanticamente:
                </p>
                <code className="block mt-2 text-xs text-orange-600 break-all font-mono bg-background rounded-lg px-3 py-2 border border-border">
                  sua-landing.com?utm_source=facebook&utm_medium=paid&utm_campaign=Nome+Campanha&utm_content=Nome+Anuncio&product_id={productId.slice(0, 8)}...
                </code>
              </div>

              {/* Aviso */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs text-amber-800">
                  <strong>Dica:</strong> Não renomeie campanhas ativas! Se trocar o nome, as vendas futuras não serão vinculadas às antigas.
                </p>
              </div>
            </div>

            <div className="p-5 border-t border-border">
              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-lg bg-foreground text-background py-2.5 text-sm font-bold transition hover:opacity-90"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
