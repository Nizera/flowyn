import type { NextRequest } from 'next/server'

/**
 * Extract the client IP from request headers, preferring Vercel's verified
 * header (cannot be spoofed by the client). Falls back through x-real-ip
 * and the rightmost x-forwarded-for entry.
 */
export function getClientIp(req: NextRequest | Request): string {
  const vercelIp = req.headers.get('x-vercel-forwarded-for')
  if (vercelIp) return vercelIp.split(',')[0].trim()

  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(s => s.trim()).filter(Boolean)
    return ips[ips.length - 1] || '127.0.0.1'
  }

  return '127.0.0.1'
}
