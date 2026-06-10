'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, Check, Wallet, Zap, PlayCircle } from 'lucide-react'
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
    title: 'Recebimento Direto',
    icon: Wallet,
    image:
      'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171918_4a5edc79-d78f-4637-ac8b-53c43c220606.png&w=1280&q=85',
    items: [
      'Conecta sua conta Asaas',
      'Recebe como CPF ou CNPJ',
      'Sem taxa Flowyn por transação',
      'Painel de saldo na Asaas',
    ],
  },
  {
    number: '02',
    title: 'Entrega Automática',
    icon: Zap,
    image:
      'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171741_ed9845ab-f5b2-4018-8ce7-07cc01823522.png&w=1280&q=85',
    items: [
      'E-book com download + e-mail',
      'Curso online com módulos e certificados',
      'Mentoria com diagnóstico e sessões',
    ],
  },
  {
    number: '03',
    title: 'Flowyn Play',
    icon: PlayCircle,
    image:
      'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171809_f56666dc-c099-4778-ad82-9ad4f209567b.png&w=1280&q=85',
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

        {/* Video Feature Card */}
        <div className="mt-10 lg:h-[480px] grid gap-3 sm:gap-2 md:gap-1 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <ScaleInView delay={0}>
            <div className="relative h-[280px] lg:h-full rounded-2xl overflow-hidden group cursor-pointer">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              >
                <source
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_133058_0504132a-0cf3-4450-a370-8ea3b05c95d4.mp4"
                  type="video/mp4"
                />
              </video>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p className="text-base font-semibold text-white">
                  Checkout editável.
                </p>
                <p className="text-sm text-white/60">
                  Order bump nativo.
                </p>
              </div>
            </div>
          </ScaleInView>

          {FEATURE_CARDS.map((card, i) => (
            <ScaleInView key={card.title} delay={(i + 1) * 0.15}>
              <div className="bg-[#212121] rounded-2xl p-5 flex flex-col h-full transition-all duration-300 hover:border-[#f97316]/20 hover:-translate-y-0.5">
                <img
                  src={card.image}
                  alt=""
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover mb-4"
                />
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

                <button className="mt-4 flex items-center gap-1.5 text-xs text-[#f97316] hover:gap-2.5 transition-all duration-200 group/link">
                  Saber mais
                  <ArrowRight size={12} className="-rotate-45 transition-transform duration-200 group-hover/link:-rotate-0" />
                </button>
              </div>
            </ScaleInView>
          ))}
        </div>
      </div>
    </section>
  )
}
