import { NextRequest, NextResponse } from 'next/server'

const SENTRY_HOST = 'sentry.io'
const SENTRY_PATH = '/api/0/envelope/'

export async function POST(req: NextRequest) {
  try {
    const envelope = await req.text()
    if (envelope.length > 1_000_000) {
      return new NextResponse('Payload too large', { status: 413 })
    }

    const piece = envelope.split('\n')[0]
    const header = JSON.parse(piece)

    const dsn = new URL(header.dsn)
    if (!dsn.hostname.endsWith('.' + SENTRY_HOST) && dsn.hostname !== SENTRY_HOST) {
      return new NextResponse('Invalid DSN', { status: 400 })
    }

    const projectId = process.env.SENTRY_PROJECT_ID
    if (projectId && dsn.pathname.replace('/', '') !== projectId) {
      return new NextResponse('Invalid project', { status: 403 })
    }

    const project_id = dsn.pathname.replace('/', '')
    const sentry_url = `https://${dsn.hostname}${SENTRY_PATH}${project_id}/`

    const response = await fetch(sentry_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: envelope,
    })

    return new NextResponse(response.body, {
      status: response.status,
    })
  } catch {
    return new NextResponse('Error tunneling events', { status: 500 })
  }
}
