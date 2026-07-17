import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, referral_code')
    .eq('id', user.id)
    .single()

  if (!profile?.referral_code) {
    return NextResponse.json({ code: null, stats: { total_referred: 0, total_commission: 0, paid_commission: 0, pending_commission: 0 }, commissions: [] })
  }

  const { data: referrals } = await supabase
    .from('referrals')
    .select('id, referred_id, referral_code, first_payment_at, created_at')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false })

  const referralIds = (referrals ?? []).map(r => r.id)

  let commissions: Array<{
    id: string
    amount: number
    status: string
    created_at: string
    paid_at: string | null
    payment_id: string
  }> = []

  if (referralIds.length > 0) {
    const { data } = await supabase
      .from('referral_commissions')
      .select('id, amount, status, created_at, paid_at, payment_id')
      .in('referral_id', referralIds)
      .order('created_at', { ascending: false })
      .limit(50)

    commissions = data ?? []
  }

  const totalCommission = commissions.reduce((sum, c) => sum + Number(c.amount), 0)
  const paidCommission = commissions.filter(c => c.status === 'paid' || c.status === 'split').reduce((sum, c) => sum + Number(c.amount), 0)
  const pendingCommission = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount), 0)

  return NextResponse.json({
    code: profile.referral_code,
    stats: {
      total_referred: referrals?.length ?? 0,
      total_commission: totalCommission,
      paid_commission: paidCommission,
      pending_commission: pendingCommission,
    },
    commissions,
    referrals: referrals ?? [],
  })
}
