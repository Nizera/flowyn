'use client'

import { useEffect, useState } from 'react'

export function UrgencyCarousel({ phrases, primaryColor }: { phrases: string[]; primaryColor: string }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (phrases.length <= 1) return
    const interval = setInterval(() => {
      setCurrent(prev => (prev + 1) % phrases.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [phrases.length])

  if (phrases.length === 0) return null

  return (
    <div className="h-10 overflow-hidden"
      style={{ backgroundColor: primaryColor || '#f97316' }}
    >
      <div className="flex h-full items-center justify-center text-center text-xs font-bold uppercase tracking-wider text-white">
        <span
          key={current}
          style={{ animation: 'fade-in-up 0.4s ease-out' }}
        >
          {phrases[current]}
        </span>
      </div>
    </div>
  )
}
