'use client'

import { useRef, useEffect, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Link, Target, Filter } from 'lucide-react'
import { useTilt } from './useTilt'

const CARDS = [
  {
    icon: Link,
    title: 'Parâmetros UTM',
    desc: 'Captura e repasse automático de parâmetros UTMs em toda a jornada até a conversão.',
  },
  {
    icon: Target,
    title: 'Eventos de Pixel',
    desc: 'Integração server-side com Meta, Google e TikTok Ads para eventos precisos.',
  },
  {
    icon: Filter,
    title: 'Funil de Conversão',
    desc: 'Visualize exatamente onde seus leads estão caindo e otimize seu checkout.',
  },
]

const STATS = [
  { value: '15.000+', label: 'EVENTOS DISPARADOS' },
  { value: '99.9%', label: '% DE PRECISÃO' },
  { value: '0ms', label: 'ATRASO NO TRACKING' },
]

function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  useEffect(() => {
    if (!isInView) return
    let start = 0
    const increment = target / (2 * 60)
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
  }, [isInView, target])

  return <span ref={ref}>{count.toLocaleString('pt-BR')}{suffix}</span>
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

export default function TrackingSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' })

  return (
    <section ref={sectionRef} className="relative bg-[#070908] px-4 py-16 md:px-6 md:py-24">
      <div className="bg-noise absolute inset-0 opacity-[0.03] pointer-events-none" />
      <div className="relative mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <span className="text-xs font-semibold uppercase tracking-widest mb-4 block text-[#f97316]">
            Rastreamento Avançado
          </span>
          <h2 className="text-gradient text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
            Todo clique rastreado. Toda
            <br />
            venda, atribuída ao <span className="text-[#f97316] font-display italic">anúncio</span>
            <br />
            <span className="text-[#f97316] font-display italic">certo.</span>
          </h2>
        </motion.div>

        {/* Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }}
            >
              <TiltCard className="p-8 h-full text-center group hover:border-[#f97316]/30 transition-colors">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <card.icon size={24} className="text-[#f97316]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">{card.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {card.desc}
                </p>
              </TiltCard>
            </motion.div>
          ))}
        </div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-10 glass-card rounded-2xl p-6 grid grid-cols-3 gap-4"
        >
          {STATS.map((stat, i) => (
            <div key={stat.label} className="text-center">
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-[#f97316]">
                {stat.value}
              </p>
              <p className="mt-1 text-[10px] sm:text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
