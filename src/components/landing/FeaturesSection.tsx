'use client'

import { useRef, useEffect, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Check, Wallet, Zap, PlayCircle, Edit3 } from 'lucide-react'
import { ScaleInView } from './animations'
import { useTilt } from './useTilt'

const FLOW_STEPS = [
  { label: 'Tráfego', icon: '📢', desc: 'Seus leads chegam via campanhas Meta, Google ou orgânico.' },
  { label: 'Checkout Flowyn', icon: '🛒', desc: 'Conversão otimizada sem taxas por transação. O checkout é seu.' },
  { label: 'Pagamento via Asaas', icon: '💳', desc: 'Dinheiro cai direto na sua conta, sem intermediários.' },
  { label: 'Entrega Automática', icon: '⚡', desc: 'Envio imediato do acesso ao produto após confirmação.' },
  { label: 'Área do Aluno', icon: '🎓', desc: 'Seu cliente consome o conteúdo em ambiente seguro e premium.' },
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

function AnimatedFunnel() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' })
  const [lineHeight, setLineHeight] = useState(0)
  const [activeStep, setActiveStep] = useState(-1)

  useEffect(() => {
    const onScroll = () => {
      if (!sectionRef.current) return
      const rect = sectionRef.current.getBoundingClientRect()
      const windowH = window.innerHeight
      const start = windowH * 0.6
      const progress = Math.max(0, Math.min(1, (start - rect.top) / rect.height))
      setLineHeight(progress * 100)
      const stepIndex = Math.floor(progress * FLOW_STEPS.length)
      setActiveStep(Math.min(stepIndex, FLOW_STEPS.length - 1))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div ref={sectionRef} className="relative max-w-3xl mx-auto py-10">
      {/* Base line */}
      <div className="absolute left-[39px] md:left-1/2 top-0 bottom-0 w-[2px] bg-white/10 -translate-x-1/2" />
      {/* Animated fill line */}
      <div
        className="absolute left-[39px] md:left-1/2 top-0 w-[2px] -translate-x-1/2 z-0 transition-all duration-200 ease-out"
        style={{
          height: `${lineHeight}%`,
          background: 'linear-gradient(to bottom, #f97316, #fb923c)',
          boxShadow: '0 0 20px rgba(249,115,22,0.3)',
        }}
      />

      <div className="space-y-20">
        {FLOW_STEPS.map((step, i) => {
          const isActive = i <= activeStep
          return (
            <div key={step.label} className="flex flex-col md:flex-row items-center gap-6 relative z-10">
              {/* Left side (odd steps) */}
              <div className={`md:w-1/2 ${i % 2 === 0 ? 'flex justify-end md:pr-16 text-left md:text-right w-full pl-24 md:pl-0 order-2 md:order-1' : 'hidden md:block order-1'}`}>
                {i % 2 === 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={isInView && isActive ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.5, delay: 0.1 }}
                  >
                    <h3 className="text-lg md:text-xl font-bold text-white mb-2">{step.label}</h3>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{step.desc}</p>
                  </motion.div>
                )}
              </div>

              {/* Center icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={isInView && isActive ? { scale: 1 } : {}}
                transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
                className={`absolute left-0 md:left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                  isActive
                    ? 'bg-[#f97316]/15 border-[#f97316] shadow-[0_0_30px_rgba(249,115,22,0.4)]'
                    : 'bg-[#1a1f1c] border-white/10'
                }`}
              >
                <span className={`text-3xl transition-all duration-500 ${isActive ? '' : 'opacity-40'}`}>
                  {step.icon}
                </span>
              </motion.div>

              {/* Right side (even steps) */}
              <div className={`md:w-1/2 ${i % 2 !== 0 ? 'flex justify-start md:pl-16 text-left w-full pl-24 md:pl-0 order-3' : 'hidden md:block order-3'}`}>
                {i % 2 !== 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={isInView && isActive ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.5, delay: 0.1 }}
                  >
                    <h3 className="text-lg md:text-xl font-bold text-white mb-2">{step.label}</h3>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{step.desc}</p>
                  </motion.div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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

export default function FeaturesSection() {
  return (
    <section id="checkout" className="relative bg-[#070908] px-4 py-16 md:px-6 md:py-24">
      <div className="bg-noise absolute inset-0 opacity-[0.03] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-16 text-center max-w-3xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-widest mb-4 block text-[#f97316]">A Solução</span>
          <h2 className="text-gradient text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
            O fluxo perfeito para o seu infoproduto
          </h2>
        </div>

        {/* Animated Funnel */}
        <AnimatedFunnel />

        {/* Feature Cards */}
        <div className="mt-20 grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_CARDS.map((card, i) => (
            <ScaleInView key={card.title} delay={i * 0.12}>
              <TiltCard className="p-6 h-full group hover:border-[#f97316]/30 transition-colors">
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
              </TiltCard>
            </ScaleInView>
          ))}
        </div>
      </div>
    </section>
  )
}
