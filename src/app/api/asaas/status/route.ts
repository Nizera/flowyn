import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    connected: !!profile?.asaas_wallet_id,
    wallet_id: profile?.asaas_wallet_id || null,
    onboarding_status: profile?.asaas_wallet_id ? 'active' : 'pending',
    profile: profile,
    email: user.email
  })

}
