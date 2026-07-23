'use client'

import { Suspense } from 'react'
import { PostHogProvider } from '@/components/PostHogProvider'

export function Analytics({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <Suspense fallback={null}>
        {children}
      </Suspense>
    </PostHogProvider>
  )
}
