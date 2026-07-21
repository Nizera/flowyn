import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Building2, CreditCard, Palette, Save, ShoppingBag, Users } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import { getPlatformAccess } from '@/lib/platform-access'
import { decryptApiKey } from '@/lib/encryption'
import { EditablePlanCard } from './EditablePlanCard'
import { PlanPixelSection } from './PlanPixelSection'

type PlanRow = {
  id: string
  name: string
  price: number
  billing_type: string
  plan_identifier: string | null
}

type PixelRow = {
  id: string
  name: string
  platform: string
  pixel_id: string
}

export default async function PlansPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const productId = params.id

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: product } = await supabase
    .from('products')
    .select('id, name, description, image_url, price, currency, is_public, is_published, checkout_mode, created_at, owner_id')
    .eq('id', productId)
    .single()

  if (!product || product.owner_id !== user.id) redirect('/dashboard')

  const access = await getPlatformAccess(user.id)

  const { data: plans } = await supabase
    .from('plans')
    .select('id, product_id, name, description, price, currency, billing_type, plan_identifier, interval, interval_count, trial_days, sort_order, asaas_plan_id, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })

  const { data: userPixelsData } = await supabase
    .from('pixels')
    .select('id, name, platform, pixel_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('name')

  const userPixels = (userPixelsData ?? []).map(p => ({ ...p, pixel_id: decryptApiKey(p.pixel_id) })) as PixelRow[]
  const planIds = ((plans ?? []) as PlanRow[]).map(p => p.id)
  const { data: allPlanPixels } = planIds.length > 0
    ? await supabase
        .from('plan_pixels')
        .select('id, plan_id, pixel:pixels(id, name, platform, pixel_id)')
        .in('plan_id', planIds)
    : { data: [] }

  async function createPlan(formData: FormData) {
    'use server'
    const name = formData.get('name') as string
    const price = formData.get('price') as string
    const billingType = formData.get('billing_type') as string

    if (!name || !price) return

    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 5) return

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const access = await getPlatformAccess(user.id)
    if (!access.allowed) return

    await supabase
      .from('plans')
      .insert({
        product_id: productId,
        name,
        price: priceNum,
        billing_type: billingType === 'recurring' ? 'recurring' : 'one_time',
      })

    revalidatePath(`/dashboard/products/${productId}/plans`)
  }

  return (
    <section className="overflow-hidden rounded-[10px] bg-card px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href={`/dashboard/products/${productId}`} className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Planos</h2>
            <p className="mt-2 text-sm text-muted">Configure precos e checkouts de {product.name}.</p>
          </div>
        </div>
      </div>

      <ProductTabs productId={productId} active="plans" />

      <div className="mt-10 max-w-6xl">
        <div className="grid border-y border-border md:grid-cols-[240px_1fr]">
          <RowTitle title="Novo plano" description="Adicione uma oferta de pagamento." />
          <form action={createPlan} className="grid gap-5 py-6 md:pl-8 lg:grid-cols-[1fr_180px_220px_auto] lg:items-end">
            <Field label="Nome do plano">
              <input name="name" required className={inputClass} placeholder="Acesso Completo" />
            </Field>
            <Field label="Preco">
              <input name="price" type="number" min="5" step="0.01" required className={inputClass} placeholder="97.00" />
            </Field>
            <Field label="Tipo">
              <select name="billing_type" className={inputClass} defaultValue="one_time">
                <option value="one_time">Preco unico</option>
                <option value="recurring">Recorrente mensal</option>
              </select>
            </Field>
            <button type="submit" disabled={!access.allowed} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-50">
              <Save className="h-4 w-4" />
              Adicionar
            </button>
          </form>
        </div>

        <div className="grid border-b border-border md:grid-cols-[240px_1fr]">
          <RowTitle title="Planos cadastrados" description="Edite valores e pixels por plano." />
          <div className="py-6 md:pl-8">
            {!plans || plans.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
                <h3 className="font-semibold text-foreground">Nenhum plano cadastrado</h3>
                <p className="mt-1 text-sm text-muted">Crie seu primeiro plano para publicar um checkout.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                {plans.map(plan => {
                  const planPixels = ((allPlanPixels ?? []) as unknown as Array<{ id: string; plan_id: string; pixel: PixelRow | null }>)
                    .filter((pp): pp is { id: string; plan_id: string; pixel: PixelRow } => pp.plan_id === plan.id && pp.pixel != null)
                    .map((pp) => ({ id: pp.id, pixel: { ...pp.pixel, pixel_id: decryptApiKey(pp.pixel.pixel_id) } }))
                  return (
                    <div key={plan.id} className="border-b border-border last:border-b-0">
                      <EditablePlanCard plan={plan} productId={productId} />
                      <PlanPixelSection
                        planId={plan.id}
                        planPixels={planPixels}
                        availablePixels={userPixels}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

const inputClass = 'h-12 w-full rounded-xl border-0 bg-surface px-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted focus:bg-card focus:ring-2 focus:ring-orange-500/20'

function ProductTabs({ productId, active }: { productId: string; active: string }) {
  const tabs = [
    { href: `/dashboard/products/${productId}`, label: 'Detalhes', icon: Building2, key: 'details' },
    { href: `/dashboard/products/${productId}/plans`, label: 'Planos', icon: CreditCard, key: 'plans' },
    { href: `/dashboard/products/${productId}/content`, label: 'Conteudo', icon: BookOpen, key: 'content' },
    { href: `/dashboard/products/${productId}/journey`, label: 'Mentoria', icon: Users, key: 'journey' },
    { href: `/dashboard/products/${productId}/checkout-editor`, label: 'Checkout', icon: Palette, key: 'checkout' },
    { href: `/dashboard/products/${productId}/order-bumps`, label: 'Order Bumps', icon: ShoppingBag, key: 'order-bumps' },
  ]
  return (
    <div className="mt-8 flex gap-2 overflow-x-auto border-b border-border">
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = tab.key === active
        return (
          <Link key={tab.key} href={tab.href} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${isActive ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted hover:text-foreground'}`}>
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}

function RowTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-6 md:pr-8">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}
