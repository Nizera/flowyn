'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'

const FEATURES = [
  'Checkout ilimitado enquanto assinatura ativa',
  'Produtos digitais: curso, e-book, mentoria',
  'Entrega automática para o comprador',
  'Área do aluno (Flowyn Play)',
  'Carteira Asaas CPF ou CNPJ',
  'Certificados automáticos',
  'Order bump nativo',
  'Upload de vídeos',
  'Rastreamento nativo: Meta Pixel + UTMs',
]

export default function PricingSection() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="custos" className="bg-[#070908] px-4 py-20 md:px-6 md:py-32">
      <div className="mx-auto max-w-lg">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-[#101412] rounded-3xl border border-white/5 p-8 md:p-10 text-center overflow-hidden"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 bg-[#f97316]/10 border border-[#f97316]/20 rounded-full px-3 py-1 mb-6">
            <Sparkles size={12} className="text-[#f97316]" />
            <span className="text-[10px] font-semibold text-[#f97316] uppercase tracking-wider">
              7 dias grátis
            </span>
          </div>

          {/* Plan Name */}
          <h3 className="text-lg font-semibold text-[#f97316] mb-2">Flowyn Pro</h3>

          {/* Price */}
          <div className="flex items-baseline justify-center gap-1 mb-4">
            <span className="text-4xl md:text-5xl font-bold text-white">R$ 97</span>
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>/mês</span>
          </div>

          {/* Zero Tax Highlight */}
          <div className="inline-block bg-[#f97316]/10 rounded-lg px-4 py-2 mb-6">
            <p className="text-sm font-semibold text-[#f97316]">
              R$ 0 de taxa Flowyn por venda
            </p>
          </div>

          {/* Features */}
          <div className="text-left space-y-3 mb-8">
            {FEATURES.map((feature) => (
              <div key={feature} className="flex items-start gap-3">
                <Check size={16} className="text-[#f97316] mt-0.5 shrink-0" />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {feature}
                </span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button className="w-full bg-[#f97316] text-[#070908] font-semibold rounded-full px-6 py-3.5 text-sm transition-all duration-300 hover:bg-[#fb923c] hover:shadow-lg hover:shadow-[#f97316]/20">
            Começar teste grátis
          </button>

          {/* Disclaimer */}
          <p className="mt-4 text-[10px] md:text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Tarifas financeiras da Asaas não estão inclusas na mensalidade Flowyn.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
