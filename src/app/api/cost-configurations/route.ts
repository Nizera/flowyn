import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rawBody = await req.text()
  if (rawBody.length > 16_384) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }
  const body = JSON.parse(rawBody)
  const { tax_percentage, asaas_flat_fee, asaas_percent_fee, product_costs } = body

  const { data, error } = await supabase
    .from('cost_configurations')
    .upsert({
      user_id: user.id,
      tax_percentage: tax_percentage || 0,
      asaas_flat_fee: asaas_flat_fee || 0,
      asaas_percent_fee: asaas_percent_fee || 0,
      product_costs: product_costs || [],
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
