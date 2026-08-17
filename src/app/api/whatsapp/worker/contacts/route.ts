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

// GET /api/whatsapp/worker/contacts - Listar contatos
export async function GET(req: NextRequest) {
  // TEMPORARIAMENTE DESABILITADO
  return NextResponse.json(
    { error: 'WhatsApp CRM está temporariamente indisponível' },
    { status: 503 }
  )
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    const search = searchParams.get('search')

    const supabase = createAdminClient()
    let query = supabase.from('wa_contacts').select('*')

    if (search) {
      query = query.or(`phone.ilike.%${search}%,push_name.ilike.%${search}%`)
    }

    query = query.order('last_seen', { ascending: false }).limit(100)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ contacts: data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    )
  }
}

// POST /api/whatsapp/worker/contacts - Criar/atualizar contato
export async function POST(req: NextRequest) {
  // TEMPORARIAMENTE DESABILITADO
  return NextResponse.json(
    { error: 'WhatsApp CRM está temporariamente indisponível' },
    { status: 503 }
  )
  try {
    const body = await req.json()
    const { phone, pushName, email, tags } = body

    if (!phone) {
      return NextResponse.json(
        { error: 'phone is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('wa_contacts')
      .upsert({
        phone,
        push_name: pushName || null,
        email: email || null,
        tags: tags || [],
        last_seen: new Date().toISOString(),
      }, { onConflict: 'phone' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ contact: data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create/update contact' },
      { status: 500 }
    )
  }
}
