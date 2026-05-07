import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { wallet_id } = await request.json()

  if (!wallet_id) {
    return NextResponse.json({ error: 'Wallet ID is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ 
      asaas_wallet_id: wallet_id,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
