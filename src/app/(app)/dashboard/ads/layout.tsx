import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { checkSubscription } from '@/lib/subscription'
import { Lock, Sparkles } from 'lucide-react'

export default async function AdsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const subscription = await checkSubscription(user.id)

  if (!subscription.isActive && subscription.plan === 'free') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500">
            <Lock className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-950">
            Meta Ads requer plano Pro
          </h2>
          <p className="mt-3 text-slate-500">
            Conecte suas contas de anúncio, gerencie campanhas e acompanhe métricas de ROAS e lucro com o plano Pro.
          </p>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold">Plano Pro — R$97/mês</p>
            <p className="mt-1 text-slate-400">7 dias de teste grátis. Sem taxa por venda.</p>
          </div>
          <Link
            href="/dashboard/settings/subscription"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:from-orange-600 hover:to-amber-600"
          >
            <Sparkles className="h-4 w-4" />
            Assinar Plano Pro
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
