'use client'

import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import { useRef, type ReactNode } from 'react'

export function WordsPullUp({
  text,
  className,
  showAsterisk,
  asteriskColor,
  style,
}: {
  text: string
  className?: string
  showAsterisk?: boolean
  asteriskColor?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const words = text.split(' ')

  return (
    <div ref={ref} className={className} style={style}>
      {words.map((word, i) => (
        <span key={i} className="relative inline-block">
          <motion.span
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block"
          >
            {word}
            {showAsterisk && i === words.length - 1 && (
              <span
                className="absolute top-[0.65em] -right-[0.3em] text-[0.31em]"
                style={{ color: asteriskColor || '#f97316' }}
              >
                *
              </span>
            )}
          </motion.span>
          {i < words.length - 1 && <span>&nbsp;</span>}
        </span>
      ))}
    </div>
  )
}

export function WordsPullUpMultiStyle({
  segments,
  className,
  containerClassName,
}: {
  segments: { text: string; className?: string }[]
  className?: string
  containerClassName?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const allWords: { word: string; className?: string }[] = []
  segments.forEach((seg) => {
    seg.text.split(' ').forEach((word) => {
      allWords.push({ word, className: seg.className })
    })
  })

  return (
    <div ref={ref} className={`inline-flex flex-wrap justify-center ${containerClassName || ''}`}>
      {allWords.map((item, i) => (
        <span key={i} className="inline-block">
          <motion.span
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className={`inline-block ${item.className || ''}`}
          >
            {item.word}
          </motion.span>
          {i < allWords.length - 1 && <span>&nbsp;</span>}
        </span>
      ))}
    </div>
  )
}

export function AnimatedLetter({
  text,
  className,
  style,
}: {
  text: string
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.8', 'end 0.2'],
  })

  const chars = text.split('')

  return (
    <p ref={ref} className={className} style={style}>
      {chars.map((char, i) => {
        const charProgress = i / chars.length
        const start = Math.max(0, charProgress - 0.1)
        const end = Math.min(1, charProgress + 0.05)
        const opacity = useTransform(scrollYProgress, [start, end], [0.15, 1])

        return (
          <motion.span key={i} style={{ opacity }} className="inline-block">
            {char === ' ' ? '\u00A0' : char}
          </motion.span>
        )
      })}
    </p>
  )
}

export function FadeInView({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function ScaleInView({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
