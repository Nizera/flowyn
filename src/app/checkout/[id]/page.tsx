import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CheckoutForm } from './checkout-form'
import { PixelScripts } from '@/components/PixelScripts'

interface CheckoutPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ref?: string }>
}

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { id } = await params
  const { ref } = await searchParams
  const supabase = await createClient()

  // Fetch the plan and its product
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('*, product:products(*, owner:profiles(full_name))')
    .eq('id', id)
    .single()

  if (planError || !plan) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">❌</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Plano não encontrado</h1>
          <p className="text-slate-500">O link de checkout que você acessou não é válido ou o plano foi removido.</p>
        </div>
      </div>
    )
  }

  // If there's a ref param, look up the affiliate
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

  // ── Fetch pixels ──────────────────────────────────────────────────────────
  // Producer pixels linked to this plan
  const { data: planPixelRows } = await supabase
    .from('plan_pixels')
    .select('pixel:pixels(platform, pixel_id, is_active)')
    .eq('plan_id', plan.id)

  const producerPixels = (planPixelRows ?? [])
    .map((r: any) => r.pixel)
    .filter((p: any) => p?.is_active)
    .map((p: any) => ({ platform: p.platform, pixel_id: p.pixel_id }))

  // Affiliate pixels linked to their affiliation — scoped to this plan or global (plan_id IS NULL)
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

  // Merge both — deduplicate by pixel_id
  const seenPixelIds = new Set<string>()
  const allPixels = [...producerPixels, ...affiliatePixels].filter(p => {
    if (seenPixelIds.has(p.pixel_id)) return false
    seenPixelIds.add(p.pixel_id)
    return true
  }) as { platform: 'meta' | 'google' | 'tiktok'; pixel_id: string }[]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Pixel Scripts — injected in <head> via next/script */}
      <PixelScripts pixels={allPixels} />

      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          {product.logo_url ? (
            <img src={product.logo_url} alt={product.name} className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="font-bold text-primary text-sm">{product.name.charAt(0)}</span>
            </div>
          )}
          <span className="font-bold text-slate-900">{product.name}</span>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium ml-auto">
            Pagamento Seguro  🔒
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Left: Checkout Form */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Finalizar Compra</h1>
              <p className="text-slate-500 text-sm mb-8">Preencha seus dados para acessar o <strong>{product.name}</strong>.</p>

              <CheckoutForm
                planId={plan.id}
                productId={plan.product_id}
                amount={plan.price}
                commissionRate={product.commission_rate}
                affiliateId={affiliateId}
                trackingId={ref || null}
                pixels={allPixels}
                orderBump={{
                  active: !!product.order_bump_price,
                  title: product.order_bump_title,
                  description: product.order_bump_description,
                  price: product.order_bump_price,
                  discountPercent: product.order_bump_discount_percent,
                  imageUrl: product.order_bump_image_url
                }}
              />
            </div>
          </div>

          {/* Right: Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-8">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Resumo do Pedido</h2>
              
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                {product.logo_url ? (
                  <img src={product.logo_url} alt={product.name} className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
                    <span className="font-bold text-primary text-2xl">{product.name.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-slate-900">{product.name}</h3>
                  <p className="text-sm text-slate-500">Plano {plan.name}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6 pb-6 border-b border-slate-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Plano</span>
                  <span className="font-medium text-slate-900">{plan.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Produtor</span>
                  <span className="font-medium text-slate-900">{product.owner?.full_name || 'Anônimo'}</span>
                </div>
                {affiliateName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Indicado por</span>
                    <span className="font-medium text-primary">{affiliateName}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-slate-900">Total</span>
                <span id="checkout-total-amount" data-base-price={plan.price} data-bump-price={product.order_bump_price || 0} className="text-3xl font-extrabold text-slate-900">
                  R$ {Number(plan.price).toFixed(2).replace('.', ',')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2 text-right">Cobrança recorrente mensal</p>
            </div>
          </div>

        </div>
      </main>

      <footer className="text-center py-8 text-xs text-slate-400">
        Powered by <span className="font-bold text-primary">Flowyn</span> — Plataforma de Afiliados para SaaS
      </footer>
    </div>
  )
}
