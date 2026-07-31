import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// GET: Buscar conquistas do usuário e configuração de badges
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Buscar todas as configurações de badges
  const { data: badgeRewards, error: rewardsError } = await supabase
    .from('badge_rewards')
    .select('*')
    .order('min_sales', { ascending: true })

  if (rewardsError) {
    return NextResponse.json({ error: rewardsError.message }, { status: 500 })
  }

  // Buscar conquistas do usuário
  const { data: achievements, error: achievementsError } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_id', user.id)

  if (achievementsError) {
    return NextResponse.json({ error: achievementsError.message }, { status: 500 })
  }

  // Buscar total de vendas do usuário (via products.owner_id, como o dashboard faz)
  // Usa amount (valor bruto) ao invés de net_value (líquido)
  const { data: orders } = await supabase
    .from('orders')
    .select('amount, product:products!inner(owner_id)')
    .eq('product.owner_id', user.id)

  const totalSales = (orders || []).reduce((sum: number, order: any) => {
    const amount = order.amount || 0
    return sum + amount
  }, 0)

  // Mapear conquistas
  const achievementsMap = new Map(achievements?.map(a => [a.badge_type, a]) || [])

  // Construir resposta
  const badges = (badgeRewards || []).map(reward => ({
    ...reward,
    achieved: achievementsMap.has(reward.badge_type),
    achieved_at: achievementsMap.get(reward.badge_type)?.achieved_at || null,
    reward_claimed: achievementsMap.get(reward.badge_type)?.reward_claimed || false,
    reward_delivered: achievementsMap.get(reward.badge_type)?.reward_delivered || false,
    tracking_code: achievementsMap.get(reward.badge_type)?.tracking_code || null,
    is_next: totalSales < reward.min_sales && reward.min_sales > 0,
  }))

  // Encontrar badge atual (o mais alto conquistado)
  const currentBadge = badges
    .filter(b => b.achieved)
    .sort((a, b) => b.min_sales - a.min_sales)[0] || null

  // Encontrar próximo badge
  const nextBadge = badges
    .filter(b => !b.achieved && b.min_sales > 0)
    .sort((a, b) => a.min_sales - b.min_sales)[0] || null

  return NextResponse.json({
    total_sales: totalSales,
    current_badge: currentBadge,
    next_badge: nextBadge,
    badges,
  })
}
