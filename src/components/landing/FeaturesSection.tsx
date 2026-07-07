'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Check, Wallet, Zap, PlayCircle, Edit3 } from 'lucide-react'
import { WordsPullUpMultiStyle, ScaleInView } from './animations'

const FLOW_STEPS = [
  { label: 'Tráfego', icon: '📢' },
  { label: 'Checkout Flowyn', icon: '🛒' },
  { label: 'Pagamento Asaas', icon: '💳' },
  { label: 'Entrega Automática', icon: '📦' },
  { label: 'Área do Aluno', icon: '🎓' },
]

const FEATURE_CARDS = [
  {
    number: '01',
    title: 'Checkout Editável',
    icon: Edit3,
    items: [
      'Página de checkout totalmente editável',
      'Order bump nativo integrado',
      'Personalização de cores e textos',
      'Links de checkout para usar onde quiser',
    ],
  },
  {
    number: '02',
    title: 'Recebimento Direto',
    icon: Wallet,
    items: [
      'Conecta sua conta Asaas',
      'Recebe como CPF ou CNPJ',
      'Sem taxa Flowyn por transação',
      'Painel de saldo na Asaas',
    ],
  },
  {
    number: '03',
    title: 'Entrega Automática',
    icon: Zap,
    items: [
      'E-book com download + e-mail',
      'Curso online com módulos e certificados',
      'Mentoria com diagnóstico e sessões',
    ],
  },
  {
    number: '04',
    title: 'Flowyn Play',
    icon: PlayCircle,
    items: [
      'Player de vídeo nativo',
      'Progresso e certificados automáticos',
      'Comentários por aula',
    ],
  },
]

function FlowDiagram() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <div ref={ref} className="relative py-8 md:py-12">
      <div className="flex items-center justify-center gap-2 md:gap-4 lg:gap-6">
        {FLOW_STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-2"
            >
              <div className="relative">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#1a1f1c] border border-white/10 flex items-center justify-center text-lg md:text-xl">
                  {step.icon}
                </div>
                <div className="dot-pulse absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                <div className="ring-pulse absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#f97316]" />
              </div>
              <span
                className="text-[10px] md:text-xs text-center max-w-[80px] md:max-w-[100px] leading-tight"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                {step.label}
              </span>
            </motion.div>
            {i < FLOW_STEPS.length - 1 && (
              <motion.div
                initial={{ scaleX: 0 }}
                animate={isInView ? { scaleX: 1 } : {}}
                transition={{ duration: 0.5, delay: i * 0.12 + 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="h-[2px] w-4 md:w-8 lg:w-12 bg-gradient-to-r from-[#f97316] to-[#f97316]/30 origin-left"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function FeaturesSection() {
  return (
    <section id="checkout" className="relative bg-[#070908] px-4 py-20 md:px-6 md:py-32 overflow-hidden">
      <div className="bg-noise absolute inset-0 opacity-[0.08] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <WordsPullUpMultiStyle
            containerClassName="text-center"
            className="text-xl sm:text-2xl md:text-3xl lg:text-4xl leading-tight"
            segments={[
              { text: 'Venda infoprodutos com checkout próprio,' },
              { text: 'entrega automática', className: 'text-[#f97316] font-display italic' },
              { text: 'e custo de plataforma previsível.' },
            ]}
          />
        </div>

        {/* Flow Diagram */}
        <FlowDiagram />

        {/* Feature Cards */}
        <div className="mt-10 grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_CARDS.map((card, i) => (
            <ScaleInView key={card.title} delay={i * 0.12}>
              <div className="bg-[#212121] rounded-2xl p-5 flex flex-col h-full transition-all duration-300 hover:border-[#f97316]/20 hover:-translate-y-0.5">
                <card.icon size={24} className="text-[#f97316] mb-4" />
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-mono text-white/40">{card.number}</span>
                  <h3 className="text-sm font-semibold text-white">{card.title}</h3>
                </div>

                <div className="flex-1 space-y-2.5">
                  {card.items.map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <Check size={14} className="text-[#f97316] mt-0.5 shrink-0" />
                      <span className="text-xs sm:text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </ScaleInView>
          ))}
        </div>
      </div>
    </section>
  )
}
