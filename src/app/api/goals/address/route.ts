import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { verifyOrigin } from '@/lib/csrf'

// GET: Buscar endereços do usuário
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('user_addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ addresses: data || [] })
}

// POST: Criar ou atualizar endereço
export async function POST(req: NextRequest) {
  const csrfError = verifyOrigin(req)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rawBody = await req.text()
  if (rawBody.length > 4096) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  let body: Record<string, unknown>
  try { body = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const { id, full_name, street, number, complement, neighborhood, city, state, zip_code, phone } = body as {
    id?: string
    full_name?: string
    street?: string
    number?: string
    complement?: string
    neighborhood?: string
    city?: string
    state?: string
    zip_code?: string
    phone?: string
  }

  if (!full_name || !street || !number || !neighborhood || !city || !state || !zip_code || !phone) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  if (id) {
    // Atualizar existente
    const { data, error } = await supabase
      .from('user_addresses')
      .update({
        full_name,
        street,
        number,
        complement: complement || null,
        neighborhood,
        city,
        state,
        zip_code,
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ address: data })
  } else {
    // Criar novo (marcar como padrão se for o primeiro)
    const { count } = await supabase
      .from('user_addresses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const isFirst = (count || 0) === 0

    const { data, error } = await supabase
      .from('user_addresses')
      .insert({
        user_id: user.id,
        full_name,
        street,
        number,
        complement: complement || null,
        neighborhood,
        city,
        state,
        zip_code,
        phone,
        is_default: isFirst,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ address: data })
  }
}
