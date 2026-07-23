'use client'

import { PostHogProvider } from '@/components/PostHogProvider'

export function Analytics({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      {children}
    </PostHogProvider>
  )
}
