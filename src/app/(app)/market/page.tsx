import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Store, Zap } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import MarketClient from './MarketClient'

export const dynamic = 'force-dynamic'

export default async function MarketPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAffiliate = profile?.role === 'affiliate'

  // Fetch products with plans and owner
  const { data: products } = await supabase
    .from('products')
    .select('*, owner:profiles(full_name), plans(*)')
    .order('created_at', { ascending: false })

  // Affiliations count per product
  const { data: affiliationCounts } = await supabase
    .from('affiliations')
    .select('product_id')

  const countMap: Record<string, number> = {}
  affiliationCounts?.forEach(a => {
    countMap[a.product_id] = (countMap[a.product_id] || 0) + 1
  })

  // Current user affiliations
  const { data: myAffiliations } = await supabase
    .from('affiliations')
    .select('product_id')
    .eq('affiliate_id', user.id)

  const affiliatedProductIds = myAffiliations?.map(a => a.product_id) || []

  async function promoteProduct(formData: FormData) {
    'use server'
    const product_id = formData.get('product_id') as string
    if (!product_id) return

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('affiliations').insert({
      affiliate_id: user.id,
      product_id,
    })

    revalidatePath('/market')
    redirect('/dashboard/affiliations')
  }

  const productCount = products?.length || 0

  return (
    <div className="w-full pb-16">
      <main className="max-w-7xl mx-auto">

        {/* Hero Header */}
        <div className="bg-gradient-to-r from-[#00e88a]/10 via-[#00e88a]/5 to-transparent rounded-2xl p-8 mb-8 border border-[#00e88a]/10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-[#00e88a]" />
                <span className="text-xs font-bold text-[#00e88a] uppercase tracking-wider">Marketplace Flowyn</span>
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">Vitrine de Produtos</h1>
              <p className="text-white/60 font-medium">
                {productCount} {productCount === 1 ? 'produto disponível' : 'produtos disponíveis'} para afiliação. Promova e ganhe comissões recorrentes.
              </p>
            </div>
            {isAffiliate && (
              <Link
                href="/dashboard/affiliations"
                className="inline-flex items-center gap-2 bg-[#111111] border border-white/10 text-white px-5 py-2.5 rounded-xl font-semibold shadow-xl hover:bg-white/5 transition-all text-sm"
              >
                Minhas Afiliações
              </Link>
            )}
          </div>
        </div>

        {!products || products.length === 0 ? (
          <div className="text-center py-24">
            <Store className="w-20 h-20 text-white/20 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-white mb-2">Vitrine Vazia</h3>
            <p className="text-white/50 max-w-md mx-auto">
              Nenhum produtor cadastrou um produto ainda. Quando novos produtos forem lançados, eles aparecerão aqui.
            </p>
          </div>
        ) : (
          <MarketClient
            products={products as any}
            affiliatedProductIds={affiliatedProductIds}
            countMap={countMap}
            isAffiliate={isAffiliate}
            promoteProduct={promoteProduct}
          />
        )}
      </main>
    </div>
  )
}
