import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const WORKER_URL = process.env.WA_WORKER_URL || 'http://localhost:3001'
const WORKER_SECRET = process.env.WA_WORKER_SECRET || process.env.WORKER_SECRET || ''

async function workerFetch(path: string, options?: RequestInit) {
  return fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WORKER_SECRET}`,
      ...options?.headers,
    },
  })
}

// POST /api/whatsapp/worker/messages - Enviar mensagem
export async function POST(req: NextRequest) {
  // TEMPORARIAMENTE DESABILITADO
  return NextResponse.json(
    { error: 'WhatsApp CRM está temporariamente indisponível' },
    { status: 503 }
  )
  try {
    const body = await req.json()
    const { sessionId, to, text, media } = body

    if (!sessionId || !to || (!text && !media)) {
      return NextResponse.json(
        { error: 'sessionId, to, and text/media are required' },
        { status: 400 }
      )
    }

    const response = await workerFetch('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({ sessionId, to, text, media }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}

// POST /api/whatsapp/worker/messages/bulk - Enviar em massa
export async function PUT(req: NextRequest) {
  // TEMPORARIAMENTE DESABILITADO
  return NextResponse.json(
    { error: 'WhatsApp CRM está temporariamente indisponível' },
    { status: 503 }
  )
  try {
    const body = await req.json()
    const { sessionId, contacts, text, media, delayMs } = body

    if (!sessionId || !contacts?.length || (!text && !media)) {
      return NextResponse.json(
        { error: 'sessionId, contacts, and text/media are required' },
        { status: 400 }
      )
    }

    const response = await workerFetch('/api/messages/bulk', {
      method: 'POST',
      body: JSON.stringify({ sessionId, contacts, text, media, delayMs }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send bulk messages' },
      { status: 500 }
    )
  }
}
