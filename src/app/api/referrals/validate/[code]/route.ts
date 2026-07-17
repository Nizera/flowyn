import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  if (!code || code.length < 4 || code.length > 20) {
    return NextResponse.json({ valid: false })
  }

  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('referral_code', code)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ valid: false })
  }

  return NextResponse.json({
    valid: true,
    referrer_name: profile.full_name ? profile.full_name.split(' ')[0] : 'Um produtor',
  })
}
