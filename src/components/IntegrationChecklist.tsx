import { createClient } from '@/utils/supabase/server'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export async function IntegrationChecklist({ productId }: { productId: string }) {
  const supabase = await createClient()

  const { data: product } = await supabase
    .from('products')
    .select('*, plans(*), orders(*), webhook_logs(*)')
    .eq('id', productId)
    .single()

  if (!product) return null

  const steps = [
    { label: 'Produto criado', done: true, required: true },
    { label: 'Plano com identificador', done: product.plans?.some((p: any) => p.plan_identifier), required: true },
    { label: 'URL de webhook cadastrada', done: Boolean(product.webhook_url), required: true },
    { label: 'Webhook testado com sucesso', done: product.webhook_logs?.some((l: any) => l.success === true), required: true },
    { label: 'Compra teste simulada', done: product.orders?.some((o: any) => o.is_sandbox === true && o.status === 'paid'), required: true },
  ]

  const requiredSteps = steps.filter(s => s.required)
  const completedRequired = requiredSteps.filter(s => s.done).length
  const progressPercent = Math.round((completedRequired / requiredSteps.length) * 100)
  const isReady = completedRequired === requiredSteps.length

  return (
    <div className="mb-8 rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-xl">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-lg font-bold text-white">Progresso da integracao</h2>
          <p className="text-sm text-white/50">Conclua os passos abaixo para publicar seu checkout com seguranca.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${isReady ? 'bg-[#00e88a]/20 text-[#00e88a]' : 'bg-white/10 text-white/70'}`}>
          {isReady ? 'Pronto para vender!' : `${progressPercent}% concluido`}
        </span>
      </div>

      <div className="mb-6 h-2 w-full overflow-hidden rounded-full border border-white/5 bg-[#0a0a0a]">
        <div
          className={`h-full transition-all duration-500 ${isReady ? 'bg-[#00e88a]' : 'bg-indigo-500'}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <div className="mt-0.5">
              {step.done ? <CheckCircle2 className="h-5 w-5 text-[#00e88a]" /> : <Circle className="h-5 w-5 text-white/20" />}
            </div>
            <p className={`text-sm font-medium ${step.done ? 'text-white' : 'text-white/50'}`}>{step.label}</p>
          </div>
        ))}
      </div>

      {!isReady && (
        <div className="mt-6 flex justify-end border-t border-white/5 pt-4">
          <Link href={`/dashboard/products/${productId}/integrations`} className="flex items-center gap-2 text-sm font-bold text-[#00e88a] hover:underline">
            Continuar integracao
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
