'use client'

import { Suspense } from 'react'
import { PostHogProvider } from '@/components/PostHogProvider'

export function Analytics({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PostHogProvider>
        {children}
      </PostHogProvider>
    </Suspense>
  )
}
