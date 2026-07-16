import { timingSafeEqual } from 'node:crypto'

/**
 * Constant-time comparison of a received `Authorization: Bearer <token>` header
 * value against an expected secret. Prevents timing attacks that `===` would
 * allow. Returns false for malformed input instead of throwing.
 */
export function safeBearerCompare(received: string, expected: string): boolean {
  if (!received || !expected) return false
  if (!received.startsWith('Bearer ')) return false
  const receivedToken = received.slice(7)
  const expectedToken = expected
  const bufA = Buffer.from(receivedToken, 'utf8')
  const bufB = Buffer.from(expectedToken, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Constant-time comparison of two opaque strings (not necessarily Bearer
 * headers). Use for webhook verify tokens, custom headers, etc.
 */
export function safeTokenEqual(a: string, b: string): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
