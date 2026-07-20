import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { hashIdentifier } from '@/lib/hash'
import { getClientIp } from '@/lib/client-ip'

type ViaCepResponse = {
  erro?: boolean
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

export async function GET(request: NextRequest, context: { params: Promise<{ cep: string }> }) {
  const { cep: rawCep } = await context.params
  const cep = rawCep.replace(/\D/g, '')

  if (!/^\d{8}$/.test(cep)) {
    return NextResponse.json({ error: 'Informe um CEP com 8 dígitos.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const ip = getClientIp(request)
  const { data: allowed } = await supabase.rpc('consume_rate_limit', {
    requested_bucket: 'cep_lookup',
    requested_identifier_hash: await hashIdentifier(ip),
    max_requests: 30,
    window_seconds: 60,
  })
  if (allowed === false) {
    return NextResponse.json({ error: 'Aguarde antes de consultar novamente.' }, { status: 429 })
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('ViaCEP indisponível')

    const address = await response.json() as ViaCepResponse
    if (address.erro) {
      return NextResponse.json({ error: 'CEP não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({
      postalCode: address.cep || cep,
      street: address.logradouro || '',
      neighborhood: address.bairro || '',
      city: address.localidade || '',
      state: address.uf || '',
    })
  } catch {
    return NextResponse.json({ error: 'Não foi possível consultar o CEP agora.' }, { status: 503 })
  }
}
