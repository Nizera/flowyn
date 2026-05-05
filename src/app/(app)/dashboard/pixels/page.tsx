import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { PixelManager } from './PixelManager'

export const dynamic = 'force-dynamic'

export default async function PixelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pixels } = await supabase
    .from('pixels')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="w-full pb-12">
      <main className="max-w-4xl mx-auto px-6 pt-8">
        <PixelManager initialPixels={pixels ?? []} />
      </main>
    </div>
  )
}
