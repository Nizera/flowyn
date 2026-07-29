import type { NextRequest } from 'next/server'

/**
 * Extract the client IP from request headers.
 * On Vercel, uses the verified x-vercel-forwarded-for header (cannot be spoofed).
 * For non-Vercel deployments, only trusts x-real-ip (which should be set by the
 * reverse proxy). x-forwarded-for is NOT used because it can be spoofed by clients.
 */
export function getClientIp(req: NextRequest | Request): string {
  const vercelIp = req.headers.get('x-vercel-forwarded-for')
  if (vercelIp) return vercelIp.split(',')[0].trim()

  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return '127.0.0.1'
}
