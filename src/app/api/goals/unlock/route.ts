import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { verifyOrigin } from '@/lib/csrf'

// POST: Forçar verificação e desbloqueio de badges
export async function POST(req: NextRequest) {
  const csrfError = verifyOrigin(req)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Buscar total de vendas do usuário
  const { data: orders } = await supabase
    .from('orders')
    .select('amount, product:products!inner(owner_id)')
    .eq('product.owner_id', user.id)
    .eq('status', 'paid')

  const totalSales = (orders || []).reduce((sum: number, order: any) => {
    return sum + (order.amount || 0)
  }, 0)

  // Buscar badges já desbloqueados
  const { data: existingBadges } = await supabase
    .from('user_achievements')
    .select('badge_type')
    .eq('user_id', user.id)

  const existingTypes = new Set((existingBadges || []).map(b => b.badge_type))

  // Buscar configuração de todos os badges
  const { data: allBadges } = await supabase
    .from('badge_rewards')
    .select('*')
    .order('min_sales', { ascending: true })

  const newBadges: string[] = []

  // Verificar cada badge
  for (const badge of allBadges || []) {
    if (!existingTypes.has(badge.badge_type)) {
      // Verificar se atingiu o mínimo
      if (badge.badge_type === 'iniciante' && totalSales > 0) {
        // Iniciante: qualquer venda
        await supabase.from('user_achievements').insert({
          user_id: user.id,
          badge_type: 'iniciante',
          total_sales_at_achievement: totalSales,
        })
        newBadges.push('iniciante')
      } else if (badge.min_sales > 0 && totalSales >= badge.min_sales) {
        // Outros badges: verificar valor mínimo
        await supabase.from('user_achievements').insert({
          user_id: user.id,
          badge_type: badge.badge_type,
          total_sales_at_achievement: totalSales,
        })
        newBadges.push(badge.badge_type)
      }
    }
  }

  return NextResponse.json({
    success: true,
    total_sales: totalSales,
    new_badges: newBadges,
    message: newBadges.length > 0
      ? `${newBadges.length} badge(s) desbloqueado(s)!`
      : 'Nenhum novo badge para desbloquear.',
  })
}
