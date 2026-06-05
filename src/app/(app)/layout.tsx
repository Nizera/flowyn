import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayoutUI } from '@/components/AppLayoutUI'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: subscription } = await supabase
    .from('platform_subscriptions')
    .select('status, trial_ends_at, grace_period_ends_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: products } = await supabase
    .from('products')
    .select('id')
    .eq('owner_id', user.id)

  let totalSales = 0
  if (products && products.length > 0) {
    const productIds = products.map((p: any) => p.id)
    const { data: orders } = await supabase
      .from('orders')
      .select('amount, status')
      .in('product_id', productIds)

    const paid = (orders ?? []).filter((o: any) => o.status === 'paid')
    totalSales = paid.reduce((sum: number, o: any) => sum + Number(o.amount), 0)
  }

  return (
    <AppLayoutUI
      profile={profile}
      user={user}
      totalSales={totalSales}
      subscription={subscription}
    >
      {children}
    </AppLayoutUI>
  )
}
