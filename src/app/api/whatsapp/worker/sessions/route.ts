import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

const WORKER_URL = process.env.WA_WORKER_URL || 'http://localhost:3001'
const WORKER_SECRET = process.env.WA_WORKER_SECRET || ''

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

// GET /api/whatsapp/worker/sessions - Listar sessões
export async function GET(req: NextRequest) {
  // TEMPORARIAMENTE DESABILITADO
  return NextResponse.json(
    { error: 'WhatsApp CRM está temporariamente indisponível' },
    { status: 503 }
  )
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('wa_sessions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ sessions: data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

// POST /api/whatsapp/worker/sessions - Criar sessão
export async function POST(req: NextRequest) {
  // TEMPORARIAMENTE DESABILITADO
  return NextResponse.json(
    { error: 'WhatsApp CRM está temporariamente indisponível' },
    { status: 503 }
  )
  try {
    const body = await req.json()
    const { sessionId, businessName } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }

    const response = await workerFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ sessionId, businessName }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}

// DELETE /api/whatsapp/worker/sessions - Deletar sessão
export async function DELETE(req: NextRequest) {
  // TEMPORARIAMENTE DESABILITADO
  return NextResponse.json(
    { error: 'WhatsApp CRM está temporariamente indisponível' },
    { status: 503 }
  )
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }

    const response = await workerFetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
