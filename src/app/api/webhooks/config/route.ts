import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { verifyOrigin } from '@/lib/csrf'
import { isUrlSafe } from '@/lib/webhooks'
import crypto from 'crypto'

const MAX_WEBHOOKS_PER_PRODUCER = 10

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: webhooks, error: whError } = await admin
      .from('producer_webhooks')
      .select('id, url, events, is_active, description, last_triggered_at, last_response_status, created_at')
      .eq('producer_id', user.id)
      .order('created_at', { ascending: false })

    if (whError) throw whError

    const webhookIds = (webhooks || []).map((w: { id: string }) => w.id)

    let deliveries: { webhook_id: string; success: boolean }[] = []
    if (webhookIds.length > 0) {
      const { data } = await admin
        .from('webhook_deliveries')
        .select('id, webhook_id, event, success, response_status, attempt_count, created_at')
        .in('webhook_id', webhookIds)
        .order('created_at', { ascending: false })
        .limit(100)
      deliveries = (data || []) as { webhook_id: string; success: boolean }[]
    }

    const statsMap = new Map<string, { total: number; success: number }>()
    for (const d of deliveries) {
      const existing = statsMap.get(d.webhook_id) || { total: 0, success: 0 }
      existing.total++
      if (d.success) existing.success++
      statsMap.set(d.webhook_id, existing)
    }

    const webhooksWithStats = (webhooks || []).map((wh: Record<string, unknown>) => ({
      ...wh,
      delivery_count: statsMap.get(wh.id as string)?.total || 0,
      success_count: statsMap.get(wh.id as string)?.success || 0,
    }))

    return NextResponse.json({ webhooks: webhooksWithStats, deliveries })
  } catch (err) {
    console.error('[Webhooks GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const csrfError = verifyOrigin(req)
  if (csrfError) return csrfError

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const admin = createAdminClient()

    // Test webhook
    if (body.test && body.webhook_id) {
      const { data: webhook, error } = await admin
        .from('producer_webhooks')
        .select('id, url, secret')
        .eq('id', body.webhook_id)
        .eq('producer_id', user.id)
        .single()

      if (error || !webhook) {
        return NextResponse.json({ error: 'Webhook não encontrado' }, { status: 404 })
      }

      if (!isUrlSafe(webhook.url)) {
        return NextResponse.json({ error: 'URL do webhook nao e segura (requer HTTPS)' }, { status: 400 })
      }

      const payload = {
        event: 'payment.confirmed',
        timestamp: new Date().toISOString(),
        data: {
          test: true,
          message: 'Este é um teste de webhook da Flowyn',
          producer_id: user.id,
        },
      }

      const bodyStr = JSON.stringify(payload)
      const signature = 'sha256=' + crypto.createHmac('sha256', webhook.secret).update(bodyStr).digest('hex')

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Flowyn-Signature': signature,
            'X-Flowyn-Event': 'payment.confirmed',
            'User-Agent': 'Flowyn-Webhook/1.0',
          },
          body: bodyStr,
          signal: AbortSignal.timeout(10_000),
        })

        const responseBody = await response.text().catch(() => '')

        await admin.from('webhook_deliveries').insert({
          webhook_id: webhook.id,
          event: 'payment.confirmed',
          payload,
          response_status: response.status,
          response_body: responseBody.substring(0, 1000),
          success: response.ok,
          attempt_count: 0,
          completed_at: response.ok ? new Date().toISOString() : null,
        })

        return NextResponse.json({ success: response.ok, status: response.status })
      } catch (err) {
        return NextResponse.json({
          error: `Falha ao conectar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
        }, { status: 500 })
      }
    }

    // Create webhook
    const { url, description, events } = body
    if (!url) {
      return NextResponse.json({ error: 'URL é obrigatória' }, { status: 400 })
    }

    if (!isUrlSafe(url)) {
      return NextResponse.json({ error: 'URL invalida. Apenas URLs HTTPS sao permitidas.' }, { status: 400 })
    }

    const validEvents = [
      'subscription.created', 'subscription.renewed', 'subscription.canceled',
      'subscription.payment_failed', 'subscription.trial_ending',
      'payment.confirmed', 'payment.failed', 'payment.refunded',
    ]
    const filteredEvents = (events || []).filter((e: string) => validEvents.includes(e))
    if (!filteredEvents.length) {
      return NextResponse.json({ error: 'Selecione pelo menos um evento' }, { status: 400 })
    }

    const { count } = await admin
      .from('producer_webhooks')
      .select('id', { count: 'exact', head: true })
      .eq('producer_id', user.id)

    if ((count || 0) >= MAX_WEBHOOKS_PER_PRODUCER) {
      return NextResponse.json({ error: `Limite de ${MAX_WEBHOOKS_PER_PRODUCER} webhooks atingido.` }, { status: 400 })
    }

    const secret = crypto.randomBytes(32).toString('hex')

    const { data: webhook, error: insertError } = await admin
      .from('producer_webhooks')
      .insert({
        producer_id: user.id,
        url,
        secret,
        events: filteredEvents,
        description: description || null,
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ webhook: { id: webhook.id }, secret })
  } catch (err) {
    console.error('[Webhooks POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const csrfError = verifyOrigin(req)
  if (csrfError) return csrfError

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const admin = createAdminClient()

    if (!body.id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active

    const { error } = await admin
      .from('producer_webhooks')
      .update(updates)
      .eq('id', body.id)
      .eq('producer_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Webhooks PATCH]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const csrfError = verifyOrigin(req)
  if (csrfError) return csrfError

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('producer_webhooks')
      .delete()
      .eq('id', id)
      .eq('producer_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Webhooks DELETE]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
