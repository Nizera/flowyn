import { redirect } from 'next/navigation'
import { CalendarClock, Check, ReceiptText, ShieldCheck, Sparkles } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { SubscriptionForm } from './SubscriptionForm'

function formatDate(value: string | null | undefined) {
  if (!value) return 'Nao definido'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value))
}

function statusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    trialing: 'Teste gratis',
    scheduled: 'Cartao configurado',
    active: 'Ativa',
    grace_period: 'Periodo de regularizacao',
    suspended: 'Suspensa',
    cancelled: 'Cancelada',
  }
  return labels[status || ''] || 'Nao configurada'
}

function isFuture(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now())
}

export default async function SubscriptionPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const { data: subscription } = await admin
    .from('platform_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: invoices } = subscription
    ? await admin
        .from('platform_subscription_invoices')
        .select('asaas_payment_id, status, value, due_date, paid_at')
        .eq('platform_subscription_id', subscription.id)
        .order('created_at', { ascending: false })
        .limit(6)
    : { data: [] }

  const hasActiveSubscription =
    subscription?.status === 'active'
    || (subscription?.status === 'scheduled' && isFuture(subscription.trial_ends_at))

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00e88a]/25 bg-[#00e88a]/10 px-3 py-1 text-xs font-bold text-[#00e88a]">
            <Sparkles className="h-3.5 w-3.5" />
            7 dias gratis + R$49/mes
          </div>
          <h1 className="text-3xl font-black text-white">Assinatura Flowyn Pro</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Use a plataforma sem taxa por venda. Voce paga apenas a mensalidade da Flowyn e as tarifas normais da transacao na Asaas.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#111] px-5 py-4">
          <p className="text-xs font-bold uppercase text-white/35">Status</p>
          <p className="mt-1 text-lg font-black text-white">{statusLabel(subscription?.status)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Taxa Flowyn por venda', 'R$0', 'Nada de percentual escondido nas vendas.'],
          ['Mensalidade', 'R$49', 'Cobrada mensalmente depois do periodo gratis.'],
          ['Teste gratis', '7 dias', `Termina em ${formatDate(subscription?.trial_ends_at)}.`],
        ].map(([title, value, description]) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-[#111] p-5">
            <p className="text-xs font-bold uppercase text-white/35">{title}</p>
            <p className="mt-2 text-3xl font-black text-white">{value}</p>
            <p className="mt-2 text-sm text-white/45">{description}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3 rounded-3xl border border-white/10 bg-[#111] p-6 md:p-8">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-2xl bg-[#00e88a]/10 p-3 text-[#00e88a]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Ativar mensalidade</h2>
              <p className="mt-1 text-sm text-white/50">
                Configure o cartao uma vez. O trial continua gratis ate a data final e depois a Asaas faz a recorrencia.
              </p>
            </div>
          </div>
          <SubscriptionForm
            defaultName={profile?.full_name || user.email || ''}
            defaultEmail={user.email || ''}
            hasActiveSubscription={hasActiveSubscription}
          />
        </section>

        <aside className="lg:col-span-2 space-y-4">
          <div className="rounded-3xl border border-white/10 bg-[#111] p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <CalendarClock className="h-4 w-4 text-[#00e88a]" />
              Acesso da conta
            </div>
            <div className="mt-5 space-y-3">
              {[
                'Criar produtos e planos',
                'Checkout transparente no ar',
                'Checkout e area do aluno inclusos',
                'Carteira CPF/CNPJ sem taxa Flowyn por venda',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-white/60">
                  <Check className="h-4 w-4 text-[#00e88a]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#111] p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
              <ReceiptText className="h-4 w-4 text-[#00e88a]" />
              Ultimas faturas
            </div>
            {!invoices || invoices.length === 0 ? (
              <p className="text-sm text-white/40">Nenhuma fatura registrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {invoices.map(invoice => (
                  <div key={invoice.asaas_payment_id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-white">{invoice.status}</span>
                      <span className="text-sm text-white/50">R$ {Number(invoice.value || 0).toFixed(2)}</span>
                    </div>
                    <p className="mt-1 text-xs text-white/35">Vencimento: {formatDate(invoice.due_date)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
