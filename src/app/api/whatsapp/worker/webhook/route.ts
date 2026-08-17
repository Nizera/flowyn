import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { safeTokenEqual } from '@/lib/safe-bearer-compare'

export const dynamic = 'force-dynamic'

interface WorkerEvent {
  event: 'message' | 'session.update' | 'session.qr' | 'session.ready' | 'session.disconnected' | 'contacts.upsert'
  sessionId: string
  data: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  // TEMPORARIAMENTE DESABILITADO
  return NextResponse.json(
    { error: 'WhatsApp CRM está temporariamente indisponível' },
    { status: 503 }
  )
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'flowyn-whatsapp-webhook' })
}
