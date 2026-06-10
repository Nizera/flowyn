'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function CtaSection() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true })

  return (
    <section className="bg-[#070908] px-4 py-20 md:py-32">
      <div ref={ref} className="mx-auto max-w-4xl text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-[1.1] text-white max-w-3xl mx-auto"
        >
          Se sua margem importa, sua plataforma não deveria virar{' '}
          <span className="text-[#f97316] font-display italic">sócio invisível</span>.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 text-sm md:text-base"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          Teste a Flowyn por 7 dias grátis. Publique um checkout e compare a diferença.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="group mt-8 inline-flex items-center gap-2 bg-[#f97316] text-[#070908] font-semibold rounded-full px-6 py-3.5 text-sm transition-all duration-300 hover:gap-3 hover:bg-[#fb923c] hover:shadow-lg hover:shadow-[#f97316]/20"
        >
          Criar conta grátis
          <ArrowRight size={16} />
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-6 text-[10px] md:text-xs"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          Sem cartão de crédito? Também aceitamos. Teste sem compromisso.
        </motion.p>
      </div>
    </section>
  )
}
