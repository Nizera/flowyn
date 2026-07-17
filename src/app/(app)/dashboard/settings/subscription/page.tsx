import { redirect } from 'next/navigation'
import { Check, ReceiptText } from 'lucide-react'
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
    .select('id, status, trial_ends_at, grace_period_ends_at, current_period_ends_at, last_payment_status, created_at, updated_at')
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
    || subscription?.status === 'grace_period'
    || (subscription?.status === 'scheduled' && isFuture(subscription.trial_ends_at))
    || (subscription?.status === 'trialing' && isFuture(subscription.trial_ends_at))

  let metricLabel = 'Teste gratis'
  let metricValue = '7 dias'
  let metricDescription = 'Experimente 7 dias sem compromisso.'

  if (subscription) {
    const now = Date.now()
    const trialEnds = subscription.trial_ends_at ? new Date(subscription.trial_ends_at).getTime() : 0
    const periodEnds = subscription.current_period_ends_at ? new Date(subscription.current_period_ends_at).getTime() : 0

    if (subscription.status === 'active' || subscription.status === 'grace_period') {
      metricLabel = 'Proxima cobranca'
      
      let nextBillingDate = subscription.current_period_ends_at ? new Date(subscription.current_period_ends_at) : null
      
      // Inteligência de recuperação se current_period_ends_at for nulo
      if (!nextBillingDate && subscription.trial_ends_at) {
        const trialDate = new Date(subscription.trial_ends_at)
        // Adiciona meses iterativamente até que a data de vencimento seja no futuro
        while (trialDate.getTime() <= now) {
          trialDate.setMonth(trialDate.getMonth() + 1)
        }
        nextBillingDate = trialDate
      }

      if (nextBillingDate && nextBillingDate.getTime() > now) {
        const days = Math.ceil((nextBillingDate.getTime() - now) / (1000 * 60 * 60 * 24))
        metricValue = `${days} ${days === 1 ? 'dia' : 'dias'}`
        metricDescription = `Renovacao em ${formatDate(nextBillingDate.toISOString())}.`
      } else {
        metricValue = 'Mensal'
        metricDescription = 'Renovacao automatica.'
      }
    } else if (trialEnds > now) {
      metricLabel = 'Teste gratis'
      const days = Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24))
      metricValue = `${days} ${days === 1 ? 'dia' : 'dias'}`
      metricDescription = `Termina em ${formatDate(subscription.trial_ends_at)}.`
    } else if (subscription.status === 'cancelled') {
      metricLabel = 'Acesso'
      if (periodEnds && periodEnds > now) {
        const days = Math.ceil((periodEnds - now) / (1000 * 60 * 60 * 24))
        metricValue = `${days} ${days === 1 ? 'dia' : 'dias'}`
        metricDescription = `Expira em ${formatDate(subscription.current_period_ends_at)}.`
      } else {
        metricValue = 'Expirado'
        metricDescription = 'Assinatura cancelada.'
      }
    }
  }

  return (
    <section className="overflow-hidden rounded-[10px] bg-white px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Assinatura</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Use a Flowyn sem taxa por venda. Voce paga a mensalidade da plataforma e as tarifas normais da transacao na Asaas.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{statusLabel(subscription?.status)}</p>
        </div>
      </div>

      <div className="mt-10 border-y border-slate-200">
        <RowTitle title="Plano" description="Condicoes da conta." />
        <div className="grid gap-6 py-6 md:grid-cols-3">
          <Metric label="Taxa Flowyn por venda" value="R$0" description="Sem percentual da plataforma." />
          <Metric label="Mensalidade" value="R$97" description="Cobrada mensalmente." />
          <Metric label={metricLabel} value={metricValue} description={metricDescription} />
        </div>
      </div>

      <div className="border-b border-slate-200">
        <RowTitle title="Pagamento" description="Cartao da mensalidade Flowyn." />
        <div className="py-6">
          <SubscriptionForm
            defaultName={profile?.full_name || user.email || ''}
            defaultEmail={user.email || ''}
            hasActiveSubscription={hasActiveSubscription}
          />
        </div>
      </div>

      <div className="border-b border-slate-200">
        <RowTitle title="Acesso" description="Recursos liberados." />
        <div className="grid gap-3 py-6 md:grid-cols-2">
          {[
            'Criar produtos e planos',
            'Checkout transparente no ar',
            'Checkout e area do aluno inclusos',
            'Carteira CPF/CNPJ sem taxa Flowyn por venda',
          ].map(item => (
            <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
              <Check className="h-4 w-4 text-emerald-600" />
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-slate-200">
        <RowTitle title="Faturas" description="Ultimas cobrancas." />
        <div className="py-6">
          {!invoices || invoices.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma fatura registrada ainda.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {invoices.map(invoice => (
                <div key={invoice.asaas_payment_id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <ReceiptText className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-base font-semibold text-slate-950">{invoice.status}</p>
                      <p className="text-xs text-slate-400">Vencimento: {formatDate(invoice.due_date)}</p>
                    </div>
                  </div>
                  <span className="text-base font-semibold text-slate-950">R$ {Number(invoice.value || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  )
}

function RowTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="pt-6">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  )
}
