import { redirect } from 'next/navigation'
import { Check, ReceiptText } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { checkSubscription } from '@/lib/subscription'
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

  // Usa checkSubscription centralizado em vez de lógica manual.
  // Isso garante consistência: cancelled + período expirado = inactive.
  const subCheck = await checkSubscription(user.id)
  const hasActiveSubscription = subCheck.isActive

  // Status visual baseado no subscription row (raw) + check (effective)
  const rawStatus = subscription?.status || null
  const displayStatus = subCheck.isActive
    ? statusLabel(rawStatus)
    : (rawStatus === 'cancelled' ? 'Cancelada' : rawStatus === 'suspended' ? 'Suspensa' : rawStatus === 'grace_period' ? 'Periodo de regularizacao' : 'Inativa')

  let metricLabel = 'Teste gratis'
  let metricValue = '7 dias'
  let metricDescription = 'Experimente 7 dias sem compromisso.'

  if (subscription) {
    const now = Date.now()
    const trialEnds = subscription.trial_ends_at ? new Date(subscription.trial_ends_at).getTime() : 0
    const periodEnds = subscription.current_period_ends_at ? new Date(subscription.current_period_ends_at).getTime() : 0

    if (subCheck.isActive && (subscription.status === 'active' || subscription.status === 'grace_period')) {
      metricLabel = 'Proxima cobranca'
      
      let nextBillingDate = subscription.current_period_ends_at ? new Date(subscription.current_period_ends_at) : null
      
      if (!nextBillingDate && subscription.trial_ends_at) {
        const trialDate = new Date(subscription.trial_ends_at)
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
    } else if (subscription.status === 'trialing' || subscription.status === 'scheduled') {
      if (trialEnds > now) {
        metricLabel = 'Teste gratis'
        const days = Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24))
        metricValue = `${days} ${days === 1 ? 'dia' : 'dias'}`
        metricDescription = `Termina em ${formatDate(subscription.trial_ends_at)}.`
      } else {
        metricLabel = 'Expirado'
        metricValue = 'Expirado'
        metricDescription = 'Teste gratis encerrado. Assine o plano Pro para continuar.'
      }
    } else if (subscription.status === 'cancelled') {
      metricLabel = 'Acesso'
      if (periodEnds > now) {
        const days = Math.ceil((periodEnds - now) / (1000 * 60 * 60 * 24))
        metricValue = `${days} ${days === 1 ? 'dia' : 'dias'}`
        metricDescription = `Expira em ${formatDate(subscription.current_period_ends_at)}.`
      } else {
        metricValue = 'Expirado'
        metricDescription = 'Assinatura cancelada. Reative para acessar recursos Pro.'
      }
    } else if (subscription.status === 'suspended') {
      metricLabel = 'Status'
      metricValue = 'Suspensa'
      metricDescription = 'Assinatura suspensa. Reative para acessar recursos Pro.'
    } else if (subscription.status === 'grace_period') {
      metricLabel = 'Regularizacao'
      if (isFuture(subscription.grace_period_ends_at)) {
        const graceEnds = new Date(subscription.grace_period_ends_at!).getTime()
        const days = Math.ceil((graceEnds - now) / (1000 * 60 * 60 * 24))
        metricValue = `${days} ${days === 1 ? 'dia' : 'dias'}`
        metricDescription = `Regularize ate ${formatDate(subscription.grace_period_ends_at)}.`
      } else {
        metricValue = 'Expirado'
        metricDescription = 'Periodo de regularizacao encerrado.'
      }
    }
  }

  return (
    <section className="overflow-hidden rounded-[10px] bg-card px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Assinatura</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Use a Flowyn sem taxa por venda. Voce paga a mensalidade da plataforma e as tarifas normais da transacao na Asaas.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Status</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{displayStatus}</p>
        </div>
      </div>

      <div className="mt-10 border-y border-border">
        <RowTitle title="Plano" description="Condicoes da conta." />
        <div className="grid gap-6 py-6 md:grid-cols-3">
          <Metric label="Taxa Flowyn por venda" value="R$0" description="Sem percentual da plataforma." />
          <Metric label="Mensalidade" value="R$97" description="Cobrada mensalmente." />
          <Metric label={metricLabel} value={metricValue} description={metricDescription} />
        </div>
      </div>

      <div className="border-b border-border">
        <RowTitle title="Pagamento" description="Cartao da mensalidade Flowyn." />
        <div className="py-6">
          <SubscriptionForm
            defaultName={profile?.full_name || user.email || ''}
            defaultEmail={user.email || ''}
            hasActiveSubscription={hasActiveSubscription}
          />
        </div>
      </div>

      <div className="border-b border-border">
        <RowTitle title="Acesso" description="Recursos liberados." />
        <div className="grid gap-3 py-6 md:grid-cols-2">
          {[
            { text: 'Criar produtos e planos', active: hasActiveSubscription },
            { text: 'Checkout transparente no ar', active: hasActiveSubscription },
            { text: 'Checkout e area do aluno inclusos', active: hasActiveSubscription },
            { text: 'Carteira CPF/CNPJ sem taxa Flowyn por venda', active: hasActiveSubscription },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-2 text-sm">
              <Check className={`h-4 w-4 ${item.active ? 'text-emerald-600' : 'text-muted opacity-40'}`} />
              <span className={item.active ? 'text-muted' : 'text-muted opacity-50 line-through'}>{item.text}</span>
            </div>
          ))}
        </div>
        {!hasActiveSubscription && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Seu plano esta inativo. Assine o plano Pro para desbloquear todos os recursos.
          </div>
        )}
      </div>

      <div className="border-b border-border">
        <RowTitle title="Faturas" description="Ultimas cobrancas." />
        <div className="py-6">
          {!invoices || invoices.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma fatura registrada ainda.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              {invoices.map(invoice => (
                <div key={invoice.asaas_payment_id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <ReceiptText className="h-4 w-4 text-muted" />
                    <div>
                      <p className="text-base font-semibold text-foreground">{invoice.status}</p>
                      <p className="text-xs text-muted">Vencimento: {formatDate(invoice.due_date)}</p>
                    </div>
                  </div>
                  <span className="text-base font-semibold text-foreground">R$ {Number(invoice.value || 0).toFixed(2)}</span>
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
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  )
}

function RowTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="pt-6">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  )
}
