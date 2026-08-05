const hits = new Map<string, { count: number; resetAt: number }>()

const DEFAULT_WINDOW_MS = 60_000
const DEFAULT_MAX = 60

export function rateLimit(
  key: string,
  max: number = DEFAULT_MAX,
  windowMs: number = DEFAULT_WINDOW_MS,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const record = hits.get(key)

  if (!record || now > record.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs }
  }

  if (record.count >= max) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt }
  }

  record.count++
  return { allowed: true, remaining: max - record.count, resetAt: record.resetAt }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, record] of hits) {
    if (now > record.resetAt) hits.delete(key)
  }
}, 60_000)
