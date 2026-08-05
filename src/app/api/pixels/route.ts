import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: pixels } = await supabase
    .from('pixels')
    .select('id, name, platform, public_token')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ pixels: pixels || [] })
}
