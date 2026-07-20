'use client'

import { useRef, useEffect, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'

const UTM_PARAMS = [
  { label: 'utm_source', value: 'meta', color: '#3b82f6' },
  { label: 'utm_medium', value: 'cpc', color: '#8b5cf6' },
  { label: 'utm_campaign', value: 'lancamento_2026', color: '#f97316' },
  { label: 'utm_content', value: 'video_v3', color: '#10b981' },
]

const PIXEL_EVENTS = [
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
]

const CONVERSION_STEPS = [
  { label: 'Visitante', icon: '👤', percent: 100 },
  { label: 'Lead', icon: '📧', percent: 68 },
  { label: 'Checkout', icon: '🛒', percent: 34 },
  { label: 'Compra', icon: '💰', percent: 12 },
]

function AnimatedCounter({ target, duration = 2 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  useEffect(() => {
    if (!isInView) return
    let start = 0
    const increment = target / (duration * 60)
    const timer = setInterval(() => {
      start += increment
      if (start >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 1000 / 60)
    return () => clearInterval(timer)
  }, [isInView, target, duration])

  return <span ref={ref}>{count.toLocaleString('pt-BR')}</span>
}

function PulseDot({ delay }: { delay: number }) {
  return (
    <motion.div
      className="absolute h-1.5 w-1.5 rounded-full bg-[#f97316]"
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0, 1.5, 0],
      }}
      transition={{
        duration: 2,
        delay,
        repeat: Infinity,
        repeatDelay: 3,
      }}
      style={{
        top: `${20 + Math.random() * 60}%`,
        left: `${10 + Math.random() * 80}%`,
      }}
    />
  )
}

function DataStream() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 12 }).map((_, i) => (
        <PulseDot key={i} delay={i * 0.4} />
      ))}
      <motion.div
        className="absolute left-0 h-px bg-gradient-to-r from-transparent via-[#f97316]/40 to-transparent"
        initial={{ top: '20%', width: '0%' }}
        animate={{ top: ['20%', '80%', '20%'], width: ['0%', '100%', '0%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute left-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"
        initial={{ top: '60%', width: '0%' }}
        animate={{ top: ['60%', '30%', '60%'], width: ['0%', '80%', '0%'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear', delay: 2 }}
      />
    </div>
  )
}

export default function TrackingSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' })
  const [activeEvent, setActiveEvent] = useState(0)

  useEffect(() => {
    if (!isInView) return
    const timer = setInterval(() => {
      setActiveEvent(prev => (prev + 1) % PIXEL_EVENTS.length)
    }, 1500)
    return () => clearInterval(timer)
  }, [isInView])

  return (
    <section ref={sectionRef} className="relative bg-[#070908] px-4 py-20 md:px-6 md:py-32 overflow-hidden">
      <DataStream />

      <div className="relative mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
            Cada clique é <span className="text-[#f97316]">rastreado</span>.
            <br />
            Cada venda, <span className="text-[#f97316]">atribuída</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm md:text-base" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Fluxo completo de rastreamento: do anúncio no Meta até a confirmação da compra.
            Pixels, UTMs e atribuição funcionando sem você configurar nada.
          </p>
        </motion.div>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Left: UTM Card */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-3xl border border-white/5 bg-[#101412] p-6 md:p-8"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Parâmetros UTM</h3>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Capturados automaticamente</p>
              </div>
            </div>

            <div className="space-y-3">
              {UTM_PARAMS.map((param, i) => (
                <motion.div
                  key={param.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="group relative rounded-xl border border-white/5 bg-[#0a0f0d] p-3 transition-all hover:border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono" style={{ color: param.color }}>{param.label}</span>
                    <span className="text-xs font-medium text-white/60">{param.value}</span>
                  </div>
                  <motion.div
                    className="absolute bottom-0 left-0 h-0.5 rounded-full"
                    style={{ background: param.color }}
                    initial={{ width: '0%' }}
                    animate={isInView ? { width: '100%' } : {}}
                    transition={{ delay: 0.6 + i * 0.15, duration: 0.8 }}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Center: Pixel Events (Live Feed) */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="rounded-3xl border border-white/5 bg-[#101412] p-6 md:p-8"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f97316]/10">
                <svg className="h-5 w-5 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Meta Pixel Events</h3>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Disparados em tempo real</p>
              </div>
            </div>

            <div className="relative space-y-2">
              <AnimatePresence mode="wait">
                {PIXEL_EVENTS.map((event, i) => (
                  <motion.div
                    key={event}
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{
                      opacity: activeEvent >= i ? 1 : 0.2,
                      y: 0,
                      height: 'auto',
                    }}
                    transition={{ duration: 0.3 }}
                    className={`flex items-center gap-3 rounded-xl p-3 transition-all ${
                      activeEvent === i
                        ? 'bg-[#f97316]/10 border border-[#f97316]/20'
                        : 'bg-[#0a0f0d] border border-transparent'
                    }`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      activeEvent === i ? 'bg-[#f97316]/20' : 'bg-white/5'
                    }`}>
                      <motion.div
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: activeEvent === i ? '#f97316' : 'rgba(255,255,255,0.2)',
                        }}
                        animate={activeEvent === i ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    </div>
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${
                        activeEvent === i ? 'text-white' : 'text-white/40'
                      }`}>{event}</span>
                    </div>
                    <span className="text-xs font-mono" style={{
                      color: activeEvent === i ? '#f97316' : 'rgba(255,255,255,0.15)',
                    }}>
                      {activeEvent === i ? 'FIRING' : 'WAIT'}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Right: Conversion Funnel */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="rounded-3xl border border-white/5 bg-[#101412] p-6 md:p-8"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Funil de Conversão</h3>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Acompanhe cada etapa</p>
              </div>
            </div>

            <div className="space-y-3">
              {CONVERSION_STEPS.map((step, i) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.6 + i * 0.15 }}
                  className="group relative"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{step.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white/80">{step.label}</span>
                        <span className="text-sm font-bold text-white">
                          <AnimatedCounter target={Math.round(step.percent * 12.4)} />
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            background: `linear-gradient(90deg, #f97316, ${
                              i === 3 ? '#10b981' : i === 2 ? '#f97316' : '#fb923c'
                            })`,
                          }}
                          initial={{ width: '0%' }}
                          animate={isInView ? { width: `${step.percent}%` } : {}}
                          transition={{ delay: 0.8 + i * 0.2, duration: 1, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 rounded-xl bg-[#0a0f0d] p-3 text-center">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>ROI do Anúncio</span>
              <p className="text-xl font-bold text-[#10b981]">
                <AnimatedCounter target={340} />%
              </p>
            </div>
          </motion.div>
        </div>

        {/* Bottom Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4"
        >
          {[
            { label: 'Eventos Pixel/mês', value: 15000, suffix: '+' },
            { label: 'Parâmetros UTM', value: 4, suffix: '' },
            { label: 'Eventos Meta', value: 5, suffix: '' },
            { label: 'Atribuição', value: 100, suffix: '%' },
          ].map((stat, i) => (
            <div key={stat.label} className="rounded-2xl border border-white/5 bg-[#101412] p-4 text-center">
              <p className="text-2xl font-bold text-[#f97316]">
                <AnimatedCounter target={stat.value} />{stat.suffix}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
