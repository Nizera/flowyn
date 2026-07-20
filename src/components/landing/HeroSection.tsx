'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { ArrowRight, Check, Menu, X } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Produto', href: '#produto' },
  { label: 'Checkout', href: '#checkout' },
  { label: 'Custos', href: '#custos' },
  { label: 'Recursos', href: '#recursos' },
  { label: 'FAQ', href: '#faq' },
]

export default function HeroSection() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 })
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const headingInView = useInView(headingRef, { once: true })

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = sectionRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setGlowPos({ x, y })
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const sectionIds = NAV_ITEMS.map((item) => item.href.replace('#', ''))
    const observers: IntersectionObserver[] = []

    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id)
          }
        },
        { rootMargin: '-40% 0px -55% 0px' },
      )
      observer.observe(el)
      observers.push(observer)
    })

    return () => observers.forEach((o) => o.disconnect())
  }, [])

  return (
    <section ref={sectionRef} className="h-screen relative" onMouseMove={handleMouseMove}>
      {/* Mouse Follow Glow */}
      <div
        className="pointer-events-none absolute z-10 h-[500px] w-[500px] rounded-full mix-blend-screen transition-all duration-300 ease-out"
        style={{
          left: `${glowPos.x}%`,
          top: `${glowPos.y}%`,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
        }}
      />
      {/* Fixed Pill Navbar */}
      <nav
        className={`fixed top-0 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 pt-3 md:pt-4 ${
          scrolled ? '' : ''
        }`}
      >
        <div
          className={`flex items-center gap-3 sm:gap-6 md:gap-12 lg:gap-14 rounded-b-2xl md:rounded-b-3xl px-4 py-2 md:px-8 transition-all duration-300 ${
            scrolled
              ? 'bg-[#070908]/90 backdrop-blur-xl shadow-lg shadow-black/20 nav-glow'
              : 'bg-[#0a0f0d]'
          }`}
        >
          <span className="text-sm font-bold text-white tracking-tight mr-1 md:mr-4">
            FLOWYN
          </span>

          <div className="hidden md:flex items-center gap-6 lg:gap-12 xl:gap-14">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.href.replace('#', '')
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="relative text-[10px] sm:text-xs md:text-sm transition-colors duration-200"
                  style={{ color: isActive ? '#f97316' : 'rgba(255,255,255,0.6)' }}
                >
                  {item.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill-active"
                      className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[#f97316] rounded-full"
                    />
                  )}
                </a>
              )
            })}
          </div>

          <button
            className="md:hidden text-white/60 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 bg-[#0a0f0d] rounded-2xl p-4 space-y-3 md:hidden"
          >
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="block text-sm"
                style={{ color: 'rgba(255,255,255,0.6)' }}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </motion.div>
        )}
      </nav>

      {/* Hero Container */}
      <div className="h-full p-0 md:p-0">
        <div className="relative h-full overflow-hidden">
          <img
            src="/brand/hero.gif"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="noise-overlay absolute inset-0 z-10" />
          <div className="absolute inset-0 z-20 bg-gradient-to-b from-[#070908]/30 via-transparent to-[#070908]/70" />

          {/* Hero Content */}
          <div className="absolute bottom-0 left-0 right-0 z-30 p-6 md:p-10 lg:p-14">
            <div className="mx-auto max-w-7xl grid grid-cols-12 gap-6 md:gap-10">
              <div className="col-span-12 md:col-span-7 lg:col-span-8 flex items-end" ref={headingRef}>
                <motion.img
                  src="/brand/logo-dark.png"
                  alt="Flowyn"
                  initial={{ opacity: 0, y: 30 }}
                  animate={headingInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full max-w-[220px] sm:max-w-[320px] md:max-w-[420px] lg:max-w-[520px] xl:max-w-[620px] h-auto object-contain"
                />
              </div>

              <div className="col-span-12 md:col-span-5 lg:col-span-4 flex flex-col justify-end gap-3 md:gap-4 pb-1 md:pb-2">
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={headingInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="text-xs sm:text-sm md:text-base leading-[1.2]"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  Checkout transparente para infoprodutores. R$ 0 de taxa por venda. Recebimento direto via Asaas.
                </motion.p>

                <motion.a
                  href="/register"
                  initial={{ opacity: 0, y: 20 }}
                  animate={headingInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="group inline-flex items-center gap-2 bg-[#f97316] rounded-full px-5 py-2.5 text-sm sm:text-base font-semibold text-[#070908] w-fit transition-all duration-300 hover:gap-3 hover:bg-[#fb923c] hover:shadow-lg hover:shadow-[#f97316]/20"
                >
                  Começar grátis — 7 dias
                  <span className="bg-black rounded-full w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                    <ArrowRight size={16} className="text-[#f97316]" />
                  </span>
                </motion.a>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={headingInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-wrap gap-2"
                >
                  {[
                    'Taxa Flowyn por venda: R$ 0',
                    'Recebimento via Asaas',
                    'Checkout privado',
                  ].map((pill) => (
                    <span
                      key={pill}
                      className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs border border-[#f97316]/30 rounded-full px-3 py-1"
                      style={{ color: 'rgba(255,255,255,0.7)' }}
                    >
                      <Check size={10} className="text-[#f97316]" />
                      {pill}
                    </span>
                  ))}
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
