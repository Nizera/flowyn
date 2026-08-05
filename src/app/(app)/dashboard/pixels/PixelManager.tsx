'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus, Trash2, ToggleLeft, ToggleRight, X, KeyRound, Code2, Globe, Copy, Check } from 'lucide-react'
import { createPixel, deletePixel, togglePixel, updatePixelCapiToken } from './actions'

function buildLlmPrompt(appUrl: string, publicToken: string, pixelId: string): string {
  return `Analise minha landing page e adicione os scripts de rastreamento Meta Ads no <head>. NÃO remova nenhum script existente. Apenas ADICIONE os 3 scripts abaixo na ordem correta.

REGRA CRÍTICA: Os links de compra (CTAs) devem usar <a href> com o formato:
<a href="${appUrl}/r/${publicToken}?dest=/checkout/SEU_PLANO_ID">
Onde SEU_PLANO_ID é o ID do plano no Flowyn (ex: 8927dbb7-5bd0-444d-a8f3-a45c13d5ab23).

Se o CTA atual já é um <a href> apontando para /checkout/, substitua o href pelo formato /r/ acima.
Se o CTA é um <button> ou não permite editar o href, mantenha como está (o producer script injeta as UTMs automaticamente).

SCRIPT 1 — Meta Pixel (dispara PageView e ViewContent no browser):
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
fbq('track', 'ViewContent');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->

SCRIPT 2 — Producer Script (injeta UTMs nos CTAs automaticamente):
<!-- FlowynPay Producer Script -->
<script src="${appUrl}/api/producer-script" defer></script>

SCRIPT 3 — Tracker.js (rastreia visitas e dispara CAPI server-side):
<!-- FlowynPay Tracker -->
<script src="${appUrl}/t/${publicToken}.js" async></script>

INSTRUÇÕES:
1. Adicione os 3 scripts no <head> da landing page, NESTA ordem
2. NÃO remova scripts existentes (Google Analytics, outros pixels, etc)
3. NÃO altere o Meta Pixel ID — use exatamente ${pixelId}
4. NÃO altere as URLs dos scripts da Flowyn
5. Se já existe um Meta Pixel na página com outro ID, mantenha ambos (pode haver mais de um)
6. Verifique se os CTAs de compra usam <a href="${appUrl}/r/${publicToken}?dest=/checkout/SEU_PLANO_ID">
7. Teste: after updating, open the page and check the browser console for errors`
}

const PLATFORMS = [
  { id: 'meta', label: 'Meta Ads', sublabel: 'Facebook & Instagram', icon: '/meta.png', color: 'bg-orange-50 border-orange-100 text-orange-600', hint: 'Ex: 1234567890123456', supportsCapi: true },
  { id: 'google', label: 'Google Ads', sublabel: 'Search & Display', icon: '/google.png', color: 'bg-red-50 border-red-100 text-red-700', hint: 'Ex: AW-123456789', supportsCapi: false },
  { id: 'tiktok', label: 'TikTok Ads', sublabel: 'TikTok & Reels', icon: '/tiktok.png', color: 'bg-surface border-border text-muted', hint: 'Ex: C1AB2DEF3GH', supportsCapi: false },
]

function getPlatform(id: string) {
  return PLATFORMS.find(p => p.id === id) ?? PLATFORMS[0]
}

interface Pixel {
  id: string
  name: string
  platform: string
  pixel_id: string
  is_active: boolean
  created_at: string
  capi_access_token?: string | null  // encriptado no DB — frontend só vê null | não-null
  public_token?: string | null
}

export function PixelManager({ initialPixels, appUrl }: { initialPixels: Pixel[]; appUrl: string }) {
  const [showModal, setShowModal] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [capiEditingId, setCapiEditingId] = useState<string | null>(null)
  const [capiDraft, setCapiDraft] = useState('')
  const [capiStatus, setCapiStatus] = useState<string | null>(null)
  const [snippetCopiedId, setSnippetCopiedId] = useState<string | null>(null)

  function handleCreate(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createPixel(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setShowModal(false)
        setSelectedPlatform(null)
      }
    })
  }

  function handleToggle(pixelId: string, current: boolean) {
    startTransition(() => togglePixel(pixelId, !current))
  }

  function handleDelete(pixelId: string) {
    if (!confirm('Remover este pixel?')) return
    startTransition(() => deletePixel(pixelId))
  }

  function openCapiEditor(pixel: Pixel) {
    setCapiEditingId(pixel.id)
    setCapiDraft('')
    setCapiStatus(pixel.capi_access_token ? 'token-definido' : 'sem-token')
  }

  function saveCapiToken(pixelId: string) {
    if (!capiDraft.trim()) {
      if (!confirm('Limpar o token CAPI deste pixel?')) return
    }
    startTransition(async () => {
      const result = await updatePixelCapiToken(pixelId, capiDraft)
      if (result?.error) {
        setCapiStatus(`Erro: ${result.error}`)
      } else {
        setCapiEditingId(null)
        setCapiDraft('')
        setCapiStatus(result?.has_token ? 'token-definido' : 'sem-token')
      }
    })
  }

  return (
    <section className="overflow-hidden rounded-[10px] bg-card px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Pixels</h2>
          <p className="mt-2 text-sm text-muted">Cadastre pixels e vincule-os aos planos para rastrear conversoes.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600">
          <Plus className="h-4 w-4" />
          Cadastrar
        </button>
      </div>

      <div className="mt-10 grid border-y border-border md:grid-cols-[240px_1fr]">
        <RowTitle title="Plataformas" description="Canais suportados." />
        <div className="grid gap-4 py-6 md:grid-cols-3 md:pl-8">
          {PLATFORMS.map(p => (
            <div key={p.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${p.color}`}>
              <img src={p.icon} alt={p.label} className="h-8 w-8 shrink-0 object-contain" />
              <div>
                <p className="text-sm font-bold">{p.label}</p>
                <p className="text-xs opacity-70">{p.sublabel}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid border-b border-border md:grid-cols-[240px_1fr]">
        <RowTitle title="Pixels cadastrados" description="Lista da sua conta." />
        <div className="py-6 md:pl-8">
          {initialPixels.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
              <h3 className="font-semibold text-foreground">Nenhum pixel cadastrado</h3>
              <p className="mt-1 text-sm text-muted">Cadastre seu primeiro pixel para rastrear conversoes no checkout.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {initialPixels.map(pixel => {
                const plat = getPlatform(pixel.platform)
                return (
                  <div key={pixel.id} className="rounded-xl border border-border bg-surface/50 p-4 transition hover:bg-surface">
                    {/* Linha principal */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${plat.color}`}>
                        <img src={plat.icon} alt={plat.label} className="h-4 w-4 object-contain" />
                        {plat.label}
                      </span>
                      <h4 className="font-semibold text-foreground">{pixel.name}</h4>
                      <button onClick={() => handleToggle(pixel.id, pixel.is_active)} className="inline-flex items-center gap-1.5 transition-colors">
                        {pixel.is_active ? (
                          <>
                            <ToggleRight className="h-5 w-5 text-emerald-600" />
                            <span className="text-xs font-medium text-emerald-700">Ativo</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-5 w-5 text-muted" />
                            <span className="text-xs font-medium text-muted">Inativo</span>
                          </>
                        )}
                      </button>
                      <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => handleDelete(pixel.id)} className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Linha de detalhes */}
                    <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border/50 pt-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted">ID:</span>
                        <code className="max-w-[160px] truncate font-mono text-muted" title={pixel.pixel_id}>{pixel.pixel_id}</code>
                      </div>

                      {plat.supportsCapi && (
                        <div className="flex items-center gap-1.5">
                          {capiEditingId === pixel.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="password"
                                value={capiDraft}
                                onChange={(e) => setCapiDraft(e.target.value)}
                                placeholder="Access Token da Conversions API"
                                className="h-8 w-48 rounded-lg border border-border bg-card px-2 text-xs font-mono"
                              />
                              <button type="button" onClick={() => saveCapiToken(pixel.id)} className="rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-orange-600">
                                Salvar
                              </button>
                              <button type="button" onClick={() => { setCapiEditingId(null); setCapiDraft('') }} className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted hover:bg-card">
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => openCapiEditor(pixel)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 transition hover:bg-card">
                              <KeyRound className={`h-3.5 w-3.5 ${pixel.capi_access_token ? 'text-emerald-600' : 'text-muted'}`} />
                              <span className={pixel.capi_access_token ? 'text-emerald-700 font-medium' : 'text-muted'}>
                                CAPI: {capiStatus === 'token-definido' || pixel.capi_access_token ? 'Configurado' : 'Configurar'}
                              </span>
                            </button>
                          )}
                        </div>
                      )}

                      {pixel.platform === 'meta' && pixel.public_token && (
                        <button
                          onClick={() => {
                            const snippet = `<script src="${appUrl}/t/${pixel.public_token}.js" async></script>`
                            navigator.clipboard.writeText(snippet).then(() => {
                              setSnippetCopiedId(pixel.id)
                              setTimeout(() => setSnippetCopiedId(null), 2000)
                            })
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 transition hover:bg-card"
                        >
                          <Code2 className="h-3.5 w-3.5 text-blue-600" />
                          <span className={snippetCopiedId === pixel.id ? 'font-medium text-blue-700' : 'text-muted'}>
                            {snippetCopiedId === pixel.id ? 'Copiado!' : 'Copiar Snippet'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {initialPixels.length > 0 && initialPixels.some(p => p.platform === 'meta' && p.public_token) && (
        <div className="grid border-b border-border md:grid-cols-[240px_1fr]">
          <RowTitle
            title="Tracking Cross-Domain"
            description="Rastrear page views na sua landing page externa."
          />
          <div className="py-6 md:pl-8">
            {(() => {
              const meta = initialPixels.find(p => p.platform === 'meta' && p.public_token)
              if (!meta) return null
              return (
                <>
                  {/* Passo 1: Snippet */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Globe className="h-4 w-4 text-blue-600" />
                      <h4 className="text-sm font-semibold text-blue-900">Passo 1 — Rastrear visitas na landing</h4>
                    </div>
                    <p className="mb-3 text-xs leading-6 text-blue-800/80">
                      Cole o snippet abaixo no <strong>{'<head>'}</strong> da sua landing page externa.
                      Isso rastreia cada visita e alimenta a aba <strong>Funil de Conversão</strong> do dashboard.
                    </p>
                    <div className="mb-3 rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-300">
                      <span className="text-slate-500">&lt;!-- FlowynPay tracker — cole no {'<head>'} da sua landing --&gt;</span>
                      <br />
                      &lt;script src=&quot;{appUrl}/t/<span className="text-emerald-400">{meta.public_token}</span>.js&quot; async&gt;&lt;/script&gt;
                    </div>
                    <p className="text-xs text-blue-800/70">
                      <strong>Como funciona:</strong> Gera um session ID, grava UTMs em cookie first-party, e dispara{' '}
                      <code className="rounded bg-blue-100 px-1 py-0.5">page_view</code> via beacon server-side.
                    </p>
                  </div>

                  {/* Passo 2: Botão Comprar */}
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-amber-600" />
                      <h4 className="text-sm font-semibold text-amber-900">Passo 2 — Configurar o botão &quot;Comprar&quot;</h4>
                    </div>
                    <p className="mb-3 text-xs leading-6 text-amber-800/80">
                      O snippet injeta UTMs automaticamente no link do checkout quando o visitante clica em &quot;Comprar&quot;.
                      <strong> Mas isso só funciona se o botão for um {'<a href>'} real.</strong>
                    </p>

                    <div className="mb-3 grid gap-3 md:grid-cols-2">
                      {/* Opção A */}
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                        <p className="mb-1 text-xs font-bold text-green-800">Se o botão é {'<a href>'} ↓</p>
                        <p className="mb-2 text-xs text-green-700">
                          O snippet já intercepta o clique automaticamente.
                          <strong> Não precisa mudar nada.</strong>
                        </p>
                        <div className="rounded bg-slate-900 p-2 font-mono text-[10px] text-slate-300">
                          <span className="text-slate-500">&lt;a href=</span><span className="text-emerald-400">&quot;.../checkout/SEU_PLANO_ID&quot;</span><span className="text-slate-500">&gt;</span>
                          <br />
                          &nbsp;&nbsp;Comprar
                          <br />
                          <span className="text-slate-500">&lt;/a&gt;</span>
                        </div>
                      </div>

                      {/* Opção B */}
                      <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                        <p className="mb-1 text-xs font-bold text-orange-800">Se o botão NÃO é {'<a href>'} ↓</p>
                        <p className="mb-2 text-xs text-orange-700">
                          Se é {'<button>'}, SPA, ou construtor de página que não permite editar o href.
                        </p>
                        <div className="rounded bg-slate-900 p-2 font-mono text-[10px] text-slate-300">
                          <span className="text-slate-500">&lt;a href=</span><span className="text-amber-300">{appUrl}/r/{meta.public_token}</span><span className="text-emerald-400">?dest=/checkout/SEU_PLANO_ID</span><span className="text-slate-500">&gt;</span>
                          <br />
                          &nbsp;&nbsp;Comprar
                          <br />
                          <span className="text-slate-500">&lt;/a&gt;</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-amber-800/70">
                      <strong>Como funciona o {'/r/'}:</strong> Planta cookies first-party no domínio da Flowyn antes de redirecionar pro checkout.
                      Assim as UTMs e o fbclid chegam certinho, mesmo que o construtor de página não permita edição de href.
                    </p>
                  </div>

                  {/* Passo 3: Producer Script */}
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-emerald-600" />
                      <h4 className="text-sm font-semibold text-emerald-900">Passo 3 — Injetar UTMs automaticamente na landing</h4>
                    </div>
                    <p className="mb-3 text-xs leading-6 text-emerald-800/80">
                      Adicione este script na <strong>{'<head>'}</strong> da sua landing page.
                      Ele lê as UTMs da URL e injeta nos links que levam ao checkout, garantindo rastreamento mesmo se o visitante navegue entre páginas.
                    </p>
                    <div className="mb-3 rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-300">
                      <span className="text-slate-500">&lt;!-- FlowynPay producer script — injeta UTMs nos CTAs --&gt;</span>
                      <br />
                      &lt;script src=&quot;{appUrl}/api/producer-script&quot; defer&gt;&lt;/script&gt;
                    </div>
                    <p className="text-xs text-emerald-800/70">
                      <strong>Como funciona:</strong> Lê UTMs da URL ou cookie, e injeta em todos os links {'<a href="/r/...">'} da página.
                      Funciona com links adicionados dinamicamente (MutationObserver). Cookie dura 30 dias.
                    </p>
                  </div>

                  {/* Prompt para LLM */}
                  <div className="mt-4 rounded-xl border border-border bg-card p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">Prompt para seu LLM</h4>
                      <button
                        onClick={() => {
                          const prompt = buildLlmPrompt(appUrl, meta.public_token || '', meta.pixel_id || '')
                          navigator.clipboard.writeText(prompt)
                          setSnippetCopiedId('llm-prompt')
                          setTimeout(() => setSnippetCopiedId(null), 2000)
                        }}
                        className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-white/10 transition"
                      >
                        {snippetCopiedId === 'llm-prompt' ? (
                          <><Check className="h-3.5 w-3.5 text-green-400" /> Copiado!</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5" /> Copiar prompt</>
                        )}
                      </button>
                    </div>
                    <p className="mb-3 text-xs text-muted">
                      Copie o prompt abaixo e cole no seu ChatGPT, Claude, Gemini ou outro LLM. Ele vai atualizar sua landing page com o rastreamento correto.
                    </p>
                    <div className="rounded-lg bg-slate-900 p-4 font-mono text-[11px] leading-5 text-slate-300 max-h-[300px] overflow-y-auto whitespace-pre-wrap">
{buildLlmPrompt(appUrl, meta.public_token || '', meta.pixel_id || '')}
                    </div>
                    <p className="mt-3 text-xs text-muted">
                      <strong>Dica:</strong> Se você usa construtor de páginas (Hotmart, Kiwify, etc.), cole o prompt no LLM e ele vai adaptar automaticamente para o construtor que você utiliza.
                    </p>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[14px] bg-card p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)] ring-1 ring-border">
            <div className="mb-7 flex items-start justify-between gap-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Cadastrar novo pixel</h2>
                <p className="mt-1 text-sm text-muted">Informe plataforma, nome e ID de rastreamento.</p>
              </div>
              <button onClick={() => { setShowModal(false); setSelectedPlatform(null) }} className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={handleCreate} className="space-y-5">
              <div>
                <label className="mb-3 block text-sm font-medium text-foreground">Plataforma *</label>
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.map(p => (
                    <button key={p.id} type="button" onClick={() => setSelectedPlatform(p.id)} className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition ${selectedPlatform === p.id ? 'border-orange-300 bg-orange-50 ring-2 ring-orange-500/10' : 'border-border bg-card hover:bg-surface'}`}>
                      <img src={p.icon} alt={p.label} className="h-8 w-8 object-contain" />
                      <span className="text-xs font-semibold leading-tight text-foreground">{p.label}</span>
                    </button>
                  ))}
                </div>
                <input type="hidden" name="platform" value={selectedPlatform ?? ''} />
              </div>

              <Field label="Nome do pixel">
                <input name="name" required placeholder="Ex: Meta Principal" className={inputClass} />
              </Field>
              <Field label="ID do pixel">
                <input name="pixel_id" required placeholder={selectedPlatform ? getPlatform(selectedPlatform).hint : 'Selecione a plataforma primeiro'} className={`${inputClass} font-mono`} />
              </Field>

              {selectedPlatform === 'meta' && (
                <Field label="Conversions API Token (opcional)">
                  <input
                    name="capi_access_token"
                    type="password"
                    placeholder="Cole o Access Token da Conversions API"
                    className={`${inputClass} font-mono`}
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    Gerado em Business Manager {'>'} Events Manager {'>'} Settings {'>'} Conversions API. <strong>Por produtor</strong> — cada pixel deve ter o seu próprio. Sem token, CAPI tenta usar o access_token da conta Meta Ads conectada.
                  </p>
                </Field>
              )}

              {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700 ring-1 ring-red-100">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setSelectedPlatform(null) }} className="flex-1 rounded-xl px-4 py-3 text-sm font-medium text-red-500 transition hover:bg-red-50">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending || !selectedPlatform} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-40">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

const inputClass = 'h-12 w-full rounded-xl border-0 bg-surface px-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted focus:bg-card focus:ring-2 focus:ring-orange-500/20'

function RowTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-6 md:pr-8">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}
