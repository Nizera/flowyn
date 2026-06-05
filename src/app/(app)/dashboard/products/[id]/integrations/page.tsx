import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Globe, CheckCircle2, Building2, CreditCard, Webhook } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import { IntegrationChecklist } from '@/components/IntegrationChecklist'
import { WebhookTestPanel } from '@/components/WebhookTestPanel'
import { WebhookLogsList } from '@/components/WebhookLogsList'

export default async function IntegrationsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const productId = params.id
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: product } = await supabase
    .from('products')
    .select('*, plans(*)')
    .eq('id', productId)
    .single()

  if (!product || product.owner_id !== user.id) {
    redirect('/dashboard')
  }

  // Fetch Webhook logs
  const { data: webhookLogs } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(50)

  async function updateWebhook(formData: FormData) {
    'use server'
    const webhook_url = formData.get('webhook_url') as string

    if (!webhook_url) return

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    await supabase
      .from('products')
      .update({ webhook_url })
      .eq('id', productId)
      .eq('owner_id', user.id)

    revalidatePath(`/dashboard/products/${productId}/integrations`)
  }

  return (
    <div className="w-full pb-12">
      <main className="max-w-3xl mx-auto px-6">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/dashboard/products/${productId}`} className="p-2.5 bg-[#111111] border border-white/10 rounded-xl hover:bg-white/5 transition-colors shadow-xl">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Webhooks / Integração</h1>
            <p className="text-white/50 text-sm mt-0.5">
              Produto: <span className="font-bold text-white">{product.name}</span>
            </p>
          </div>
        </div>

        {/* Quick Nav Tabs */}
        <div className="flex bg-[#111111] rounded-2xl border border-white/10 p-2 gap-2 mb-10 overflow-x-auto shadow-xl custom-scrollbar">
          <Link href={`/dashboard/products/${productId}`} className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-white/50 hover:bg-white/5 hover:text-white font-medium rounded-xl transition-colors">
            <Building2 className="w-4 h-4" />
            Detalhes do Produto
          </Link>
          <Link href={`/dashboard/products/${productId}/plans`} className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-white/50 hover:bg-white/5 hover:text-white font-medium rounded-xl transition-colors">
            <CreditCard className="w-4 h-4" />
            Planos de Venda
          </Link>
          <Link href={`/dashboard/products/${productId}/integrations`} className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white font-bold rounded-xl border border-white/5">
            <Webhook className="w-4 h-4" />
            Webhooks / Integração
          </Link>
        </div>

        {/* Integration Checklist */}
        <IntegrationChecklist productId={productId} />


        {/* Webhook Section */}
        <div className="mb-10 mt-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Globe className="w-4 h-4 text-[#00e88a]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Webhook URL</h2>
              <p className="text-xs text-white/40">Configure o endpoint que receberá notificações de pagamento</p>
            </div>
          </div>

          <p className="text-sm text-white/60 mb-6 leading-relaxed">
            Quando uma venda for processada com sucesso, nosso sistema fará automaticamente um <code className="bg-[#111111] px-2 py-0.5 rounded text-[#00e88a] text-xs font-bold border border-white/10">POST</code> para a URL abaixo com os dados do cliente.
          </p>


          <form action={updateWebhook} className="space-y-5">
            <div>
              <label htmlFor="webhook_url" className="block text-sm font-semibold text-white/70 mb-2">
                Endpoint Recebedor
              </label>
              <input 
                type="url" 
                id="webhook_url" 
                name="webhook_url" 
                defaultValue={product.webhook_url || ''}
                required 
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00e88a]/30 focus:border-[#00e88a] transition-all outline-none shadow-xl" 
                placeholder="https://api.seusistema.com/webhooks/flowyn"
              />
              {product.webhook_url && (
                <div className="flex items-center gap-1.5 mt-3">
                  <CheckCircle2 className="w-4 h-4 text-[#00e88a]" />
                  <p className="text-sm text-[#00e88a] font-medium">Webhook configurado e ativo</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2">
              <button 
                type="submit" 
                className="inline-flex items-center gap-2 bg-[#00e88a] hover:bg-[#00e88a]/90 text-black font-bold py-3.5 px-8 rounded-xl transition-all shadow-[0_0_15px_rgba(0,232,138,0.3)] hover:shadow-[0_0_25px_rgba(0,232,138,0.5)]"
              >
                <Save className="w-5 h-5" />
                Salvar URL
              </button>
            </div>
          </form>
        </div>

        {/* Test Panel */}
        <WebhookTestPanel productId={productId} currentUrl={product.webhook_url} plans={product.plans || []} />

        {/* Webhook Logs */}
        <WebhookLogsList logs={webhookLogs || []} />


      </main>
    </div>
  )
}
