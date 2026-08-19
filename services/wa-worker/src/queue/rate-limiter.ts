import { config } from '../config'
import { createChildLogger } from '../lib/logger'

const log = createChildLogger('rate-limiter')

interface RateLimitState {
  lastSentAt: number
  sentCount: number
  windowStart: number
}

const perUserLimits = new Map<string, RateLimitState>()

export function canSendMessage(userId: string, to: string): { allowed: boolean; waitMs?: number } {
  const key = `${userId}:${to}`
  const now = Date.now()
  const state = perUserLimits.get(key)

  if (!state) {
    perUserLimits.set(key, { lastSentAt: now, sentCount: 1, windowStart: now })
    return { allowed: true }
  }

  const timeSinceLast = now - state.lastSentAt
  const minDelay = config.worker.messageDelayMinMs

  if (timeSinceLast < minDelay) {
    const waitMs = minDelay - timeSinceLast + Math.random() * 1000
    return { allowed: false, waitMs }
  }

  state.lastSentAt = now
  state.sentCount++
  return { allowed: true }
}

export function getRandomDelay(): number {
  const min = config.worker.messageDelayMinMs
  const max = config.worker.messageDelayMaxMs
  return Math.floor(Math.random() * (max - min + 1)) + min
}

setInterval(() => {
  const cutoff = Date.now() - 60_000
  for (const [key, state] of perUserLimits.entries()) {
    if (state.lastSentAt < cutoff) {
      perUserLimits.delete(key)
    }
  }
}, 60_000)
