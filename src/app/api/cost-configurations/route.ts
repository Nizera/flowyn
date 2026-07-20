import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { verifyOrigin } from '@/lib/csrf'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('cost_configurations')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[Cost Config] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ 
    data: data || {
      tax_percentage: 0,
      asaas_flat_fee: 0,
      asaas_percent_fee: 0,
      product_costs: []
    }
  })
}

export async function POST(req: NextRequest) {
  const csrfError = verifyOrigin(req)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rawBody = await req.text()
  if (rawBody.length > 16_384) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }
  const { tax_percentage, asaas_flat_fee, asaas_percent_fee, product_costs } = body as {
    tax_percentage?: number
    asaas_flat_fee?: number
    asaas_percent_fee?: number
    product_costs?: unknown[]
  }

  // Validate numeric values are non-negative and within bounds
  const tp = Number(tax_percentage) || 0
  const af = Number(asaas_flat_fee) || 0
  const ap = Number(asaas_percent_fee) || 0
  if (tp < 0 || tp > 100) return NextResponse.json({ error: 'tax_percentage must be 0-100' }, { status: 400 })
  if (af < 0 || af > 100) return NextResponse.json({ error: 'asaas_flat_fee must be 0-100' }, { status: 400 })
  if (ap < 0 || ap > 100) return NextResponse.json({ error: 'asaas_percent_fee must be 0-100' }, { status: 400 })

  const { data, error } = await supabase
    .from('cost_configurations')
    .upsert({
      user_id: user.id,
      tax_percentage: tp,
      asaas_flat_fee: af,
      asaas_percent_fee: ap,
      product_costs: Array.isArray(product_costs) ? product_costs : [],
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    console.error('[Cost Config] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
