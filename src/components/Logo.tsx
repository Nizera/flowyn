'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function Logo({ className = "h-10 w-auto" }: { className?: string }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <img src="/brand/logo-black-transparent.png" alt="Flowyn" className={className} />
  }

  const logoSrc = resolvedTheme === 'dark' 
    ? '/brand/logo-white-transparent.png' 
    : '/brand/logo-black-transparent.png'

  return <img src={logoSrc} alt="Flowyn" className={className} />
}
