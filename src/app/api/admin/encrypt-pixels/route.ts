import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { encryptApiKey, isEncrypted } from '@/lib/encryption'
import { safeTokenEqual } from '@/lib/safe-bearer-compare'

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || !safeTokenEqual(secret || '', cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: pixels, error } = await supabase
    .from('pixels')
    .select('id, pixel_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let encrypted = 0
  let skipped = 0

  for (const pixel of pixels ?? []) {
    if (isEncrypted(pixel.pixel_id)) {
      skipped++
      continue
    }

    const { error: updateError } = await supabase
      .from('pixels')
      .update({ pixel_id: encryptApiKey(pixel.pixel_id) })
      .eq('id', pixel.id)

    if (!updateError) encrypted++
  }

  return NextResponse.json({ encrypted, skipped, total: pixels?.length ?? 0 })
}
