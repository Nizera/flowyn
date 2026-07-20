import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * Verify that the request originated from the same origin.
 * Returns null if valid, or a NextResponse error if invalid.
 * Use at the top of POST/PUT/DELETE handlers for CSRF protection.
 */
export function verifyOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin')
  if (!origin || origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Origem da requisicao invalida.' }, { status: 403 })
  }
  return null
}
