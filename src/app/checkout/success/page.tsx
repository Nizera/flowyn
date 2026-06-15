import Link from 'next/link'
import { ArrowRight, BookOpen, CheckCircle2, Mail, ShieldCheck } from 'lucide-react'
import { ResendDeliveryButton } from './ResendDeliveryButton'
import { createAdminClient } from '@/utils/supabase/admin'
import { findAuthUserIdByEmail } from '@/lib/student-password-link'

type Product = {
  id: string
  name: string
  product_type?: string | null
  delivery_type?: string | null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  if (!local || !domain) return 'seu e-mail'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`
}

function productTypeLabel(productType?: string | null) {
  if (productType === 'course') return 'curso'
  if (productType === 'mentoria') return 'mentoria'
  return 'produto'
}

function UnavailableState({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-orange-50 p-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
          <ShieldCheck className="h-10 w-10 text-amber-600" />
        </div>
        <h1 className="text-2xl font-black text-slate-950">{title}</h1>
        <p className="mt-3 leading-7 text-slate-500">{message}</p>
      </section>
    </main>
  )
}

export default async function CheckoutSuccessPage(props: {
  searchParams: Promise<{ order_id?: string; redirect_status?: string }>
}) {
  const searchParams = await props.searchParams
  const orderId = searchParams.order_id || ''

  if (searchParams.redirect_status && searchParams.redirect_status !== 'succeeded') {
    return <UnavailableState title="Pagamento não concluído" message="O pagamento foi cancelado ou não pôde ser processado." />
  }

  if (!isUuid(orderId)) {
    return <UnavailableState title="Pedido não encontrado" message="Não foi possível localizar os dados desta compra." />
  }

  const supabase = createAdminClient()
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, product:products(id, name, product_type, delivery_type)')
    .eq('id', orderId)
    .maybeSingle()

  if (!order || order.status !== 'paid') {
    return <UnavailableState title="Pagamento em processamento" message="A confirmação ainda não chegou. Aguarde alguns segundos e atualize esta página." />
  }

  const product = order.product as unknown as Product | null
  const { data: customer } = await supabase
    .from('order_customer_private')
    .select('customer_email')
    .eq('order_id', orderId)
    .maybeSingle()

  if (!product || !customer?.customer_email) {
    return <UnavailableState title="Compra confirmada" message="Seu pedido foi pago, mas não foi possível carregar os detalhes da entrega." />
  }

  const isPlatformProduct = product.delivery_type === 'platform'
  const typeLabel = productTypeLabel(product.product_type)
  const maskedEmail = maskEmail(customer.customer_email)
  let needsPasswordSetup = false

  if (isPlatformProduct) {
    const { data: orderAccess } = await supabase
      .from('student_access')
      .select('user_id')
      .eq('order_id', orderId)
      .maybeSingle()

    let access = orderAccess
    if (!access) {
      const { data: emailAccess } = await supabase
        .from('student_access')
        .select('user_id')
        .eq('product_id', product.id)
        .ilike('access_email', customer.customer_email)
        .maybeSingle()
      access = emailAccess
    }

    if (!access) {
      const userId = await findAuthUserIdByEmail(supabase, customer.customer_email)
      if (userId) access = { user_id: userId }
    }

    if (access?.user_id) {
      const { data: setupEvent } = await supabase
        .from('notification_events')
        .select('id')
        .eq('user_id', access.user_id)
        .eq('product_id', product.id)
        .eq('event_type', 'student_password_setup')
        .limit(1)
        .maybeSingle()

      needsPasswordSetup = Boolean(setupEvent)
    }
  }

  const accessPath = `/learn/${product.id}`
  const loginUrl = `/login?redirect=${encodeURIComponent(accessPath)}`

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-orange-50 p-4">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl sm:p-10">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>

        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Pagamento aprovado</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Compra confirmada!</h1>
        <p className="mt-3 text-lg font-bold text-slate-800">{product.name}</p>

        {isPlatformProduct ? (
          <>
            <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left">
              <div className="flex gap-3 text-emerald-800">
                <BookOpen className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">Seu acesso à {typeLabel} foi liberado.</p>
                  <p className="mt-1 text-sm leading-6">
                    {needsPasswordSetup
                      ? `Enviamos para ${maskedEmail} um link para você definir sua senha e entrar.`
                      : `Use sua conta da Flowyn para acessar o conteúdo. A confirmação também foi enviada para ${maskedEmail}.`}
                  </p>
                </div>
              </div>
            </div>

            <Link
              href={loginUrl}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              {needsPasswordSetup ? 'Já defini minha senha' : 'Acessar área do aluno'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left">
            <div className="flex gap-3 text-emerald-800">
              <Mail className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">Seu produto foi enviado por e-mail.</p>
                <p className="mt-1 text-sm leading-6">
                  Confira a caixa de entrada e o spam de {maskedEmail}. Links de arquivos podem expirar por segurança.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <ResendDeliveryButton orderId={orderId} />
        </div>

        <p className="mt-7 text-xs text-slate-400">
          Pedido <span className="font-mono">{orderId.slice(0, 8)}...</span>
        </p>
      </section>
    </main>
  )
}
