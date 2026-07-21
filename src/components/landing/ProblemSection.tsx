'use client'

import { useRef } from 'react'
import { TrendingUp, Settings, Layout } from 'lucide-react'
import { WordsPullUpMultiStyle, AnimatedLetter, ScaleInView } from './animations'
import { useTilt } from './useTilt'

const PROBLEM_CARDS = [
  {
    icon: TrendingUp,
    title: 'Percentual sobre faturamento',
    desc: 'Cada venda aumenta o custo da plataforma. Quanto mais você vende, mais entrega para a ferramenta.',
  },
  {
    icon: Settings,
    title: 'Entrega manual',
    desc: 'Cliente pagou, mas você ainda precisa liberar acesso manualmente. Processo que não escala.',
  },
  {
    icon: Layout,
    title: 'Checkout sem controle',
    desc: 'Sua oferta fica limitada ao padrão genérico de outra plataforma, sem personalização.',
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

export default function ProblemSection() {
  const charRef = useRef<HTMLDivElement>(null)

  return (
    <section id="produto" className="relative bg-[#070908] px-4 py-16 md:px-6 md:py-24 problem-section">
      <div className="bg-noise absolute inset-0 opacity-[0.03] pointer-events-none" />
      <div className="mx-auto max-w-6xl">
        <div className="relative z-10 bg-[#101412] rounded-3xl p-6 md:p-12 lg:p-16">
          <span className="text-[#f97316] text-[10px] sm:text-xs uppercase tracking-widest font-semibold">
            O problema
          </span>

          <div className="mt-6 max-w-4xl">
            <WordsPullUpMultiStyle
              containerClassName="text-left"
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[0.95]"
              segments={[
                { text: 'Quando sua plataforma' },
                { text: 'cobra por venda,', className: 'text-[#f97316] font-display italic' },
                { text: 'ela fica mais cara justamente quando você cresce.' },
              ]}
            />
          </div>

          <div ref={charRef} className="mt-8 max-w-2xl">
            <AnimatedLetter
              text="Taxas percentuais parecem pequenas no começo. Mas quando você vende mais, elas viram um custo recorrente que acompanha todo lançamento, toda campanha e todo produto novo. A Flowyn existe para mudar isso."
              className="text-sm md:text-base leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            />
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PROBLEM_CARDS.map((card, i) => (
              <ScaleInView key={card.title} delay={i * 0.15}>
                <TiltCard className="p-6 h-full hover:border-[#f97316]/30 hover:-translate-y-1 transition-all duration-300">
                  <card.icon size={24} className="text-[#f97316] mb-4" />
                  <h3 className="text-base font-semibold text-white mb-2">{card.title}</h3>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {card.desc}
                  </p>
              </TiltCard>
              </ScaleInView>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
