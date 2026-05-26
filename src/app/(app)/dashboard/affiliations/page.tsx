import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { Link2, TrendingUp, DollarSign, Store, ExternalLink, Copy } from 'lucide-react'
import { AffiliationPixelSection } from './AffiliationPixelSection'

function isLocalUrl(value?: string) {
  return !value || /localhost|127\.0\.0\.1/i.test(value)
}

export default async function AffiliationsPage() {
  const supabase = await createClient()
  const requestHeaders = await headers()
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') || 'https'
  const requestAppUrl = host ? `${protocol}://${host}` : 'http://localhost:3000'
  const checkoutBase = (isLocalUrl(configuredAppUrl) ? requestAppUrl : configuredAppUrl!).replace(/\/$/, '')

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: affiliations } = await supabase
    .from('affiliations')
    .select(`
      id,
      tracking_id,
      status,
      created_at,
      product:products(
        id,
        name,
        logo_url,
        commission_rate,
        plans(id, name, price)
      )
    `)
    .eq('affiliate_id', user.id)
    .order('created_at', { ascending: false })

  // Get order stats per product
  const { data: orders } = await supabase
    .from('orders')
    .select('product_id, amount, commission_amount, status')
    .eq('affiliate_id', user.id)

  const ordersByProduct: Record<string, { sales: number; commission: number }> = {}
  orders?.forEach(o => {
    if (o.status === 'paid') {
      if (!ordersByProduct[o.product_id]) ordersByProduct[o.product_id] = { sales: 0, commission: 0 }
      ordersByProduct[o.product_id].sales += Number(o.amount)
      ordersByProduct[o.product_id].commission += Number(o.commission_amount)
    }
  })

  // Fetch this affiliate's global pixels
  const { data: userPixels } = await supabase
    .from('pixels')
    .select('id, name, platform, pixel_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('name')

  // Fetch all affiliation_pixels for this user's affiliations
  const affIds = (affiliations ?? []).map(a => a.id)
  const { data: allAffPixels } = affIds.length > 0
    ? await supabase
        .from('affiliation_pixels')
        .select('id, affiliation_id, plan_id, pixel:pixels(id, name, platform, pixel_id)')
        .in('affiliation_id', affIds)
    : { data: [] }

  return (
    <div className="w-full pb-12">
      <main className="max-w-5xl mx-auto">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Minhas Afiliações</h1>
            <p className="text-white/50 text-sm mt-0.5">Gerencie seus links de divulgação e acompanhe suas vendas por produto.</p>
          </div>
          <Link href="/market" className="inline-flex items-center gap-2 bg-[#00e88a] hover:bg-[#00e88a]/90 text-black font-bold px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(0,232,138,0.3)] transition-all text-sm hover:-translate-y-0.5">
            <Store className="w-4 h-4" />
            Encontrar Produtos
          </Link>
        </div>

        {!affiliations || affiliations.length === 0 ? (
          <div className="text-center py-24 bg-[#111111] border border-white/10 rounded-2xl shadow-xl">
            <Link2 className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Nenhuma afiliação ainda</h3>
            <p className="text-white/50 mb-6 max-w-md mx-auto">
              Visite o Marketplace para encontrar produtos de alta conversão e começar a ganhar comissões recorrentes.
            </p>
            <Link href="/market" className="bg-[#00e88a] text-black font-bold px-6 py-3 rounded-xl hover:bg-[#00e88a]/90 transition-all shadow-[0_0_20px_rgba(0,232,138,0.3)] hover:-translate-y-0.5 inline-block">
              Ir para o Mercado
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {affiliations.map((aff) => {
              const product = aff.product as any
              const stats = ordersByProduct[product.id] || { sales: 0, commission: 0 }
              const plans = product.plans as any[] || []
              const minPrice = plans.length > 0 ? Math.min(...plans.map((p: any) => Number(p.price))) : null

              const affiliateLinks = plans.map((pl: any) => ({
                planName: pl.name,
                url: `${checkoutBase}/checkout/${pl.id}?ref=${aff.tracking_id}`
              }))

              return (
                <div key={aff.id} className="bg-[#111111] border border-white/10 rounded-2xl shadow-xl hover:border-white/20 transition-all overflow-hidden">
                  {/* Product Header */}
                  <div className="p-6 flex flex-col lg:flex-row lg:items-center gap-6">
                    <div className="flex items-center gap-4 lg:w-64 flex-shrink-0">
                      {product.logo_url ? (
                        <img src={product.logo_url} alt={product.name} className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00e88a] to-[#00e88a]/60 flex items-center justify-center shadow-[0_0_15px_rgba(0,232,138,0.3)]">
                          <span className="font-extrabold text-black text-xl">{product.name.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <h3 className="text-lg font-bold text-white">{product.name}</h3>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${aff.status === 'active' ? 'bg-[#00e88a]/10 text-[#00e88a] border border-[#00e88a]/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                          {aff.status === 'active' ? '● Ativo' : '● Inativo'}
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-8 flex-1">
                      <div className="text-center">
                        <p className="text-xs text-white/50 font-medium mb-1">Comissão</p>
                        <span className="inline-flex items-center gap-1 bg-[#00e88a]/10 text-[#00e88a] border border-[#00e88a]/20 px-3 py-1.5 rounded-lg text-sm font-extrabold">
                          <TrendingUp className="w-3.5 h-3.5" />
                          {product.commission_rate}%
                        </span>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-white/50 font-medium mb-1">Vendas Geradas</p>
                        <span className="text-sm font-bold text-white">
                          R$ {stats.sales.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-white/50 font-medium mb-1">Comissões Ganhas</p>
                        <span className="text-sm font-extrabold text-[#00e88a]">
                          R$ {stats.commission.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <div className="text-center hidden md:block">
                        <p className="text-xs text-white/50 font-medium mb-1">Desde</p>
                        <span className="text-sm text-white/70 font-medium">
                          {new Date(aff.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Affiliate Links */}
                  <div className="border-t border-white/5 bg-[#0a0a0a] px-6 py-4">
                    <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Seus Links de Divulgação</p>
                    {affiliateLinks.length === 0 ? (
                      <p className="text-sm text-white/30">Nenhum plano configurado pelo produtor ainda.</p>
                    ) : (
                      <div className="space-y-2">
                        {affiliateLinks.map((link: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-3 bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 hover:border-white/20 transition-colors">
                            <span className="text-xs font-bold text-white/50 w-24 flex-shrink-0">{link.planName}</span>
                            <code className="flex-1 text-xs text-white/70 font-mono truncate">{link.url}</code>
                            <a href={link.url} target="_blank" className="p-1.5 hover:bg-[#00e88a]/10 rounded-lg transition-colors group" title="Abrir checkout">
                              <ExternalLink className="w-3.5 h-3.5 text-white/40 group-hover:text-[#00e88a] transition-colors" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Affiliate Pixel Section */}
                  {(() => {
                    const affPixels = (allAffPixels ?? [])
                      .filter(ap => ap.affiliation_id === aff.id)
                      .map(ap => ({ id: ap.id, pixel: ap.pixel as any, plan_id: (ap as any).plan_id ?? null }))
                    return (
                      <AffiliationPixelSection
                        affiliationId={aff.id}
                        affPixels={affPixels}
                        availablePixels={(userPixels ?? []) as any}
                        plans={plans.map((pl: any) => ({ id: pl.id, name: pl.name }))}
                      />
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
