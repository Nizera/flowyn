'use client'

import { useRef } from 'react'
import { Zap, Layout, Shield, Smartphone, BarChart3, Headphones } from 'lucide-react'
import { ScaleInView } from './animations'
import { useTilt } from './useTilt'

const RECURSOS = [
  {
    icon: Zap,
    title: 'Checkout otimizado',
    desc: 'Página de checkout editável com order bump nativo e personalização total da oferta.',
  },
  {
    icon: Layout,
    title: 'Área do aluno',
    desc: 'Player de vídeo, progresso automático, certificados e comentários por aula.',
  },
  {
    icon: Shield,
    title: 'Cobrança recorrente',
    desc: 'Assinaturas e parcelamento via Asaas com controle total de cobranças.',
  },
  {
    icon: Smartphone,
    title: 'Responsivo',
    desc: 'Checkout e área do aluno funcionam perfeitamente em qualquer dispositivo.',
  },
  {
    icon: BarChart3,
    title: 'Relatórios',
    desc: 'Acompanhe vendas, conversão e métricas do seu negócio em tempo real.',
  },
  {
    icon: Headphones,
    title: 'Suporte priorizado',
    desc: 'Suporte direto por WhatsApp com tempo de resposta médio de 15 minutos.',
  },
]

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { handleMouseMove, handleMouseLeave } = useTilt(ref)
  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`glass-card tilt-card ${className}`}
    >
      {children}
    </div>
  )
}

export default function RecursosSection() {
  return (
    <section id="recursos" className="relative bg-[#070908] px-4 py-20 md:px-6 md:py-32 overflow-hidden">
      <div className="bg-noise absolute inset-0 opacity-[0.06] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-gradient text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
            Tudo que você precisa para vender online, <span className="text-[#f97316] font-display italic">sem surpresas.</span>
          </h2>
        </div>

        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((recurso, i) => (
            <ScaleInView key={recurso.title} delay={i * 0.1}>
              <TiltCard className="p-6 h-full hover:border-[#f97316]/30 hover:-translate-y-1 transition-all duration-300">
                <recurso.icon size={24} className="text-[#f97316] mb-4" />
                <h3 className="text-base font-semibold text-white mb-2">{recurso.title}</h3>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {recurso.desc}
                </p>
              </TiltCard>
            </ScaleInView>
          ))}
        </div>
      </div>
    </section>
  )
}
