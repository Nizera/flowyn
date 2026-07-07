import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ error: 'Integração WhatsApp não configurada.' }, { status: 503 })
}

export async function POST() {
  return NextResponse.json({ error: 'Integração WhatsApp não configurada.' }, { status: 503 })
}
