import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { CheckoutForm } from './checkout-form'
import { PixelScripts } from '@/components/PixelScripts'
import { getPlatformAccess } from '@/lib/platform-access'
import { normalizeCheckoutConfig } from '@/lib/checkout-customization'
import { UrgencyCarousel } from '@/components/UrgencyCarousel'
import { decryptApiKey } from '@/lib/encryption'

interface CheckoutPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ preview?: string; draft?: string }>
}

function money(value: number) {
  return Number(value || 0).toFixed(2).replace('.', ',')
}

export default async function CheckoutPage(props: CheckoutPageProps) {
  const params = await props.params
  const searchParams = await props.searchParams
  const { id } = params
  const { preview, draft } = searchParams
  const supabase = await createClient()
  const admin = createAdminClient()
  const isPreviewMode = preview === '1'
  const wantsDraftPreview = isPreviewMode && draft === '1'

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('*, product:products(*, owner:profiles(full_name))')
    .eq('id', id)
    .single()

  if (planError || !plan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl text-red-600">!</div>
          <h1 className="text-2xl font-black text-slate-950">Plano nao encontrado</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">O link de checkout que voce acessou nao e valido ou o plano foi removido.</p>
        </div>
      </div>
    )
  }

  type Product = {
    id: string
    name: string
    logo_url?: string | null
    owner_id?: string | null
    mockupImageUrl?: string | null
    delivery_type?: string | null
    owner?: { full_name?: string | null }
  }

  const product = plan.product as Product
  let canPreviewDraft = false
  if (wantsDraftPreview) {
    const { data: { user } } = await supabase.auth.getUser()
    canPreviewDraft = user?.id === product.owner_id
  }

  let customization: { draft_config?: unknown; published_config?: unknown } | null = null
  if (canPreviewDraft) {
    const { data } = await admin
      .from('checkout_customizations')
      .select('draft_config, published_config')
      .eq('product_id', product.id)
      .maybeSingle()
    customization = data
  } else {
    const { data } = await admin
      .from('checkout_customizations')
      .select('published_config')
      .eq('product_id', product.id)
      .maybeSingle()
    customization = data
  }

  const { data: orderBumps } = await admin
    .from('product_order_bumps')
    .select('title, description, price, original_price, image_url')
    .eq('product_id', product.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)

  const firstBump = orderBumps && orderBumps.length > 0 ? orderBumps[0] : null

  const checkoutConfig = normalizeCheckoutConfig(
    canPreviewDraft ? customization?.draft_config : customization?.published_config,
    product
  )
  const producerAccess = await getPlatformAccess(product.owner_id ?? '')

  if (!producerAccess.allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-2xl font-black text-amber-600">!</div>
          <h1 className="text-2xl font-black text-slate-950">Checkout temporariamente indisponivel</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Este produto esta pausado enquanto o produtor regulariza o acesso a plataforma.</p>
        </div>
      </div>
    )
  }

  const { data: planPixelRows } = await supabase
    .from('plan_pixels')
    .select('pixel:pixels(platform, pixel_id, is_active)')
    .eq('plan_id', plan.id)

  const producerPixels = (planPixelRows ?? [])
    .map((r: any) => {
      const px = Array.isArray(r.pixel) ? r.pixel[0] : r.pixel
      return px as { platform: string; pixel_id: string; is_active: boolean } | undefined
    })
    .filter((p): p is { platform: string; pixel_id: string; is_active: boolean } => Boolean(p?.is_active))
    .map(p => ({ platform: p.platform, pixel_id: decryptApiKey(p.pixel_id) }))

  const seenPixelIds = new Set<string>()
  const allPixels = producerPixels.filter(p => {
    if (seenPixelIds.has(p.pixel_id)) return false
    seenPixelIds.add(p.pixel_id)
    return true
  }) as { platform: 'meta' | 'google' | 'tiktok'; pixel_id: string }[]

  return (
    <div className="min-h-screen" style={{ backgroundColor: checkoutConfig.backgroundColor }}>
      {!isPreviewMode && <PixelScripts pixels={allPixels} />}

      <UrgencyCarousel phrases={checkoutConfig.urgencyPhrases} primaryColor={checkoutConfig.primaryColor} />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        {checkoutConfig.blocks.banner && checkoutConfig.bannerImageUrl && (
          <img src={checkoutConfig.bannerImageUrl} alt={product.name} className="mb-6 h-52 w-full rounded-[28px] border border-slate-200 object-cover shadow-sm lg:h-64" />
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_390px] lg:items-start">
          <section className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {(checkoutConfig.mockupImageUrl || product.logo_url) && (
                  <img
                    src={checkoutConfig.mockupImageUrl || product.logo_url || ''}
                    alt={product.name}
                    className="h-24 w-24 rounded-2xl border border-slate-200 object-cover shadow-sm"
                  />
                )}
                <div className="max-w-2xl">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em]" style={{ color: checkoutConfig.primaryColor }}>
                    Acesso imediato
                  </p>
                  <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                    {checkoutConfig.headline}
                  </h1>
                  <p className="mt-3 text-base leading-7 text-slate-600">
                    {checkoutConfig.subheadline}
                  </p>
                </div>
              </div>

              {checkoutConfig.blocks.benefits && checkoutConfig.benefits.length > 0 && (
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {checkoutConfig.benefits.map(benefit => (
                    <div key={benefit} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
                      <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: checkoutConfig.primaryColor }} />
                      {benefit}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {checkoutConfig.blocks.testimonials && checkoutConfig.testimonials.length > 0 && (
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Depoimentos</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">O que nossos alunos dizem</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {checkoutConfig.testimonials.map((testimonial, index) => (
                    <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="mb-3 text-2xl leading-none" style={{ color: checkoutConfig.primaryColor }}>&ldquo;</div>
                      <p className="text-sm leading-6 text-slate-700">{testimonial.text}</p>
                      <p className="mt-4 text-xs font-black text-slate-500">— {testimonial.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
                <div className="mb-6 border-b border-slate-100 pb-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Pagamento</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">Dados do comprador</h2>
                </div>
              <CheckoutForm
                planId={plan.id}
                productId={plan.product_id}
                amount={plan.price}
                pixels={allPixels}
                primaryColor={checkoutConfig.primaryColor}
                buttonText={checkoutConfig.buttonText}
                previewMode={isPreviewMode}
                recurring={plan.billing_type === 'recurring'}
                orderBump={firstBump ? {
                  active: true,
                  title: firstBump.title,
                  description: firstBump.description,
                  price: Number(firstBump.price),
                  imageUrl: firstBump.image_url || checkoutConfig.orderBumpImageUrl || '',
                } : { active: false, title: null, description: null, price: null, imageUrl: null }}
              />
            </div>
          </section>

          <aside className="lg:sticky lg:top-8">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Resumo do pedido</p>
                <div className="mt-5 flex gap-4">
                  {(checkoutConfig.mockupImageUrl || product.logo_url) ? (
                    <img
                    src={checkoutConfig.mockupImageUrl || product.logo_url || ''}
                      alt={product.name}
                      className="h-20 w-20 rounded-2xl border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                      <span className="text-2xl font-black" style={{ color: checkoutConfig.primaryColor }}>{product.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-lg font-black leading-tight text-slate-950">{product.name}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">Plano {plan.name}</p>
                    {plan.billing_type === 'recurring' && <p className="mt-1 text-xs font-bold text-slate-400">Cobranca mensal</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">Produto</span>
                  <span className="text-right font-bold text-slate-900">{product.name}</span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">Produtor</span>
                  <span className="text-right font-bold text-slate-900">{product.owner?.full_name || 'Anonimo'}</span>
                </div>
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-bold text-slate-900">R$ {money(plan.price)}{plan.billing_type === 'recurring' ? '/mês' : ''}</span>
                  </div>
                  <div className="mt-3 flex justify-between text-sm">
                    <span className="text-slate-500">Taxa Flowyn</span>
                    <span className="font-black text-emerald-600">R$ 0,00</span>
                  </div>
                </div>
                <div className="flex items-end justify-between border-t border-slate-100 pt-5">
                  <span className="text-base font-black text-slate-950">Total</span>
                  <span id="checkout-total-amount" data-base-price={plan.price} data-bump-price={firstBump?.price || 0} className="text-3xl font-black text-slate-950">
                    R$ {money(plan.price)}{plan.billing_type === 'recurring' ? '/mês' : ''}
                  </span>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-6">
                <div className="rounded-2xl bg-white p-4 text-xs font-bold leading-5 text-slate-500">
                  {checkoutConfig.securityText}
                </div>
                {checkoutConfig.blocks.guarantee && (
                  <div className="rounded-2xl bg-white p-4 text-xs font-bold leading-5 text-slate-500">
                    {checkoutConfig.guaranteeText}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {checkoutConfig.blocks.faq && checkoutConfig.faq.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Perguntas frequentes</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">FAQ</h2>
            <div className="mt-6 space-y-3">
              {checkoutConfig.faq.map((item, index) => (
                <details key={index} className="group rounded-2xl border border-slate-200 bg-slate-50" open={index === 0}>
                  <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-bold text-slate-900 outline-none [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <span className="ml-2 shrink-0 text-slate-400 transition-transform group-open:rotate-180">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-5 pb-4 text-sm leading-6 text-slate-600">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="px-4 pb-10 text-center text-xs font-semibold text-slate-400">
        Powered by <span className="font-black" style={{ color: checkoutConfig.primaryColor }}>Flowyn</span>
      </footer>
    </div>
  )
}
