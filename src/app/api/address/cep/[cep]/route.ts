import { NextResponse } from 'next/server'

type ViaCepResponse = {
  erro?: boolean
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

export async function GET(_request: Request, context: { params: Promise<{ cep: string }> }) {
  const { cep: rawCep } = await context.params
  const cep = rawCep.replace(/\D/g, '')

  if (!/^\d{8}$/.test(cep)) {
    return NextResponse.json({ error: 'Informe um CEP com 8 dígitos.' }, { status: 400 })
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
