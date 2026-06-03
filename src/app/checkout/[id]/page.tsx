import { createClient } from '@/utils/supabase/server'
import { CheckoutForm } from './checkout-form'
import { PixelScripts } from '@/components/PixelScripts'
import { getPlatformAccess } from '@/lib/platform-access'
import { normalizeCheckoutConfig } from '@/lib/checkout-customization'

interface CheckoutPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ref?: string }>
}

function money(value: number) {
  return Number(value || 0).toFixed(2).replace('.', ',')
}

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { id } = await params
  const { ref } = await searchParams
  const supabase = await createClient()

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

  let affiliateId: string | null = null
  let affiliateName: string | null = null
  let affiliationId: string | null = null

  if (ref) {
    const { data: affiliation } = await supabase
      .from('affiliations')
      .select('id, affiliate_id, affiliate:profiles(full_name)')
      .eq('tracking_id', ref)
      .eq('product_id', plan.product_id)
      .single()

    if (affiliation) {
      affiliateId = affiliation.affiliate_id
      affiliateName = (affiliation.affiliate as any)?.full_name || null
      affiliationId = affiliation.id as string
    }
  }

  const product = plan.product as any
  const { data: customization } = await supabase
    .from('checkout_customizations')
    .select('published_config')
    .eq('product_id', product.id)
    .maybeSingle()

  const checkoutConfig = normalizeCheckoutConfig(customization?.published_config, product)
  const producerAccess = await getPlatformAccess(product.owner_id)

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
    .map((r: any) => r.pixel)
    .filter((p: any) => p?.is_active)
    .map((p: any) => ({ platform: p.platform, pixel_id: p.pixel_id }))

  let affiliatePixels: { platform: string; pixel_id: string }[] = []
  if (affiliationId) {
    const { data: affPixelRows } = await supabase
      .from('affiliation_pixels')
      .select('pixel:pixels(platform, pixel_id, is_active), plan_id')
      .eq('affiliation_id', affiliationId)

    affiliatePixels = (affPixelRows ?? [])
      .filter((r: any) => r.plan_id === null || r.plan_id === plan.id)
      .map((r: any) => r.pixel)
      .filter((p: any) => p?.is_active)
      .map((p: any) => ({ platform: p.platform, pixel_id: p.pixel_id }))
  }

  const seenPixelIds = new Set<string>()
  const allPixels = [...producerPixels, ...affiliatePixels].filter(p => {
    if (seenPixelIds.has(p.pixel_id)) return false
    seenPixelIds.add(p.pixel_id)
    return true
  }) as { platform: 'meta' | 'google' | 'tiktok'; pixel_id: string }[]

  return (
    <div className="min-h-screen" style={{ backgroundColor: checkoutConfig.backgroundColor }}>
      <PixelScripts pixels={allPixels} />

      <header className="border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          {product.logo_url ? (
            <img src={product.logo_url} alt={product.name} className="h-10 w-10 rounded-xl border border-slate-200 object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-sm font-black" style={{ color: checkoutConfig.primaryColor }}>{product.name.charAt(0)}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">{product.name}</p>
            <p className="text-xs font-medium text-slate-500">Checkout seguro Flowyn</p>
          </div>
          <div className="ml-auto hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {checkoutConfig.securityText}
          </div>
        </div>
      </header>

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
                    src={checkoutConfig.mockupImageUrl || product.logo_url}
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

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Pagamento</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">Dados do comprador</h2>
                </div>
                <div className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-500">
                  Cartao
                </div>
              </div>
              <CheckoutForm
                planId={plan.id}
                productId={plan.product_id}
                amount={plan.price}
                commissionRate={product.commission_rate}
                affiliateId={affiliateId}
                trackingId={ref || null}
                pixels={allPixels}
                primaryColor={checkoutConfig.primaryColor}
                buttonText={checkoutConfig.buttonText}
                orderBump={{
                  active: !!product.order_bump_price,
                  title: product.order_bump_title,
                  description: product.order_bump_description,
                  price: product.order_bump_price,
                  discountPercent: product.order_bump_discount_percent,
                  imageUrl: checkoutConfig.orderBumpImageUrl || product.order_bump_image_url
                }}
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
                      src={checkoutConfig.mockupImageUrl || product.logo_url}
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
                {affiliateName && (
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-slate-500">Indicado por</span>
                    <span className="text-right font-bold" style={{ color: checkoutConfig.primaryColor }}>{affiliateName}</span>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-bold text-slate-900">R$ {money(plan.price)}</span>
                  </div>
                  <div className="mt-3 flex justify-between text-sm">
                    <span className="text-slate-500">Taxa Flowyn</span>
                    <span className="font-black text-emerald-600">R$ 0,00</span>
                  </div>
                </div>
                <div className="flex items-end justify-between border-t border-slate-100 pt-5">
                  <span className="text-base font-black text-slate-950">Total</span>
                  <span id="checkout-total-amount" data-base-price={plan.price} data-bump-price={product.order_bump_price || 0} className="text-3xl font-black text-slate-950">
                    R$ {money(plan.price)}
                  </span>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-6">
                <div className="rounded-2xl bg-white p-4 text-xs font-bold leading-5 text-slate-500">
                  {checkoutConfig.securityText}. A Flowyn nao armazena os dados do cartao.
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

      <footer className="px-4 pb-10 text-center text-xs font-semibold text-slate-400">
        Powered by <span className="font-black" style={{ color: checkoutConfig.primaryColor }}>Flowyn</span>
      </footer>
    </div>
  )
}
