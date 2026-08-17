import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { Lock } from 'lucide-react'
import Link from 'next/link'

export default async function WhatsAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  // TEMPORARIAMENTE DESABILITADO - Função será implementada depois
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500">
          <Lock className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          WhatsApp CRM
        </h2>
        <p className="mt-3 text-muted">
          Esta funcionalidade está temporariamente indisponível e será implementada em breve.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:from-orange-600 hover:to-amber-600"
        >
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  )
}
