import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayoutUI } from '@/components/AppLayoutUI'

type ProductRow = {
  id: string
  name: string
}

type OrderRow = {
  id: string
  amount: string | number | null
  status: string
  created_at: string
  customer_name: string
  product_id: string
}

type Notification = {
  id: string
  title: string
  body: string
  time: string
  read: boolean
  href?: string
}

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
    .select('id, name')
    .eq('owner_id', user.id)

  const productIds = products?.map((p: ProductRow) => p.id) ?? []

  let totalSales = 0
  const notifications: Notification[] = []

  if (productIds.length > 0) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, amount, status, created_at, customer_name, product_id')
      .in('product_id', productIds)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(20)

    const orders = recentOrders ?? []

    const paid = orders.filter((o: OrderRow) => o.status === 'paid')
    totalSales = paid.reduce((sum: number, o: OrderRow) => sum + Number(o.amount), 0)

    const productMap = new Map(products!.map((p: ProductRow) => [p.id, p.name]))

    for (const o of orders) {
      if (o.status === 'paid') {
        notifications.push({
          id: `sale-${o.id}`,
          title: 'Nova venda!',
          body: `${o.customer_name} comprou ${productMap.get(o.product_id) ?? 'seu produto'} — ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(o.amount))}`,
          time: o.created_at,
          read: false,
          href: '/dashboard/sales',
        })
      } else if (o.status === 'pending') {
        notifications.push({
          id: `pending-${o.id}`,
          title: 'Pagamento pendente',
          body: `${o.customer_name} iniciou a compra de ${productMap.get(o.product_id) ?? 'seu produto'} — aguardando confirmação`,
          time: o.created_at,
          read: false,
          href: '/dashboard/sales',
        })
      }
    }
  }

  if (subscription) {
    const now = new Date()
    const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null
    const graceEnd = subscription.grace_period_ends_at ? new Date(subscription.grace_period_ends_at) : null

    if (subscription.status === 'trialing' && trialEnd && trialEnd > now) {
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysLeft <= 3) {
        notifications.push({
          id: 'trial-ending',
          title: 'Teste gratuito terminando',
          body: `Seu período de teste termina em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}. Garanta seu plano para não perder o acesso.`,
          time: trialEnd.toISOString(),
          read: false,
          href: '/dashboard/settings/subscription',
        })
      }
    }

    if (subscription.status === 'grace_period') {
      notifications.push({
        id: 'grace-period',
        title: 'Regularize sua assinatura',
        body: graceEnd
          ? `Sua assinatura está em período de carência até ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(graceEnd)}.`
          : 'Sua assinatura está pendente de regularização.',
        time: (graceEnd ?? now).toISOString(),
        read: false,
        href: '/dashboard/settings/subscription',
      })
    }

    if (['suspended', 'cancelled'].includes(subscription.status)) {
      notifications.push({
        id: 'subscription-blocked',
        title: 'Assinatura bloqueada',
        body: 'Sua assinatura está bloqueada. Regularize para reativar seus checkouts e produtos.',
        time: now.toISOString(),
        read: false,
        href: '/dashboard/settings/subscription',
      })
    }
  }

  return (
    <AppLayoutUI
      profile={profile}
      user={user}
      totalSales={totalSales}
      subscription={subscription}
      notifications={notifications}
    >
      {children}
    </AppLayoutUI>
  )
}
