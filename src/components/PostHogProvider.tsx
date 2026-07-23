'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import posthog from 'posthog-js'

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: {
      dom_event_allowlist: ['click', 'submit', 'change'],
      url_allowlist: ['*flowyn.com.br*'],
    },
  })
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname && posthog) {
      posthog.capture('$pageview', { $current_url: window.location.href })
    }
  }, [pathname])

  return <>{children}</>
}
