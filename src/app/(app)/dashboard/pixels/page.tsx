import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { decryptApiKey } from '@/lib/encryption'
import { PixelManager } from './PixelManager'
import { getAppUrl } from '@/lib/app-url'

export const dynamic = 'force-dynamic'

export default async function PixelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pixels } = await supabase
    .from('pixels')
    .select('id, name, platform, pixel_id, is_active, created_at, public_token, capi_access_token')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const decryptedPixels = (pixels ?? []).map(p => ({
    ...p,
    pixel_id: decryptApiKey(p.pixel_id),
    // public_token permanece UUID público — apenas para exibir no snippet
    public_token: p.public_token,
    capi_access_token: p.capi_access_token ? 'has_token' : null,
  }))

  const appUrl = getAppUrl()

  return (
    <div className="w-full pb-12">
      <main className="mx-auto max-w-7xl">
        <PixelManager initialPixels={decryptedPixels} appUrl={appUrl} />
      </main>
    </div>
  )
}
