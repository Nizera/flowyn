import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getClientIp } from '@/lib/client-ip'
import { sendCapiEvent } from '@/lib/meta-capi'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    if (rawBody.length > 16_384) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }
    const body = JSON.parse(rawBody)
    const { plan_id, event_name, tracking_params, session_id, event_id, pixel_id } = body

    if (!plan_id || !event_name) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    if (event_name !== 'page_view' && event_name !== 'initiate_checkout') {
      return NextResponse.json({ error: 'Invalid event name' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Rate limit: 60 events/min per IP
    const ip = getClientIp(req)
    const { data: allowed } = await supabase.rpc('consume_rate_limit', {
      p_identifier: `funnel:${ip}`,
      p_action: 'funnel_event',
      p_max_requests: 60,
      p_window_seconds: 60,
    })
    if (allowed === false) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // Resolve product_id from plans
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('product_id')
      .eq('id', plan_id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const utm_source = tracking_params?.utm_source || null
    const utm_medium = tracking_params?.utm_medium || null
    const utm_campaign = tracking_params?.utm_campaign || null
    const utm_content = tracking_params?.utm_content || null
    const utm_term = tracking_params?.utm_term || null
    const fbclid = tracking_params?.fbclid || null
    const gclid = tracking_params?.gclid || null
    const ttclid = tracking_params?.ttclid || null
    const src = tracking_params?.src || null
    const sck = tracking_params?.sck || null
    const fbp = tracking_params?._fbp || null
    const fbc = tracking_params?._fbc || null
    const finalSessionId = session_id || tracking_params?.fl_sid || null

    // Insert funnel event
    const { error: insertError } = await supabase
      .from('funnel_events')
      .insert({
        product_id: plan.product_id,
        plan_id,
        event_name,
        session_id: finalSessionId,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        fbclid,
        gclid,
        ttclid,
        src,
        sck,
        _fbp: fbp,
        _fbc: fbc,
      })

    if (insertError) {
      console.error('Error inserting funnel event:', insertError)
      return NextResponse.json({ error: 'Failed to record event' }, { status: 500 })
    }

    // CAPI server-side (não-bloqueante)
    const capiEventName = event_name === 'page_view' ? 'PageView' as const : 'InitiateCheckout' as const
    const finalEventId = event_id || `${event_name}_${crypto.randomUUID()}`

    // Resolve producer_id do produto
    const { data: product } = await supabase
      .from('products')
      .select('owner_id')
      .eq('id', plan.product_id)
      .maybeSingle()

    if (product?.owner_id) {
      const userAgent = req.headers.get('user-agent') || ''
      const eventSourceUrl = req.headers.get('referer') || `${req.nextUrl.origin}/checkout/${plan_id}`

      // Envia CAPI de forma não-bloqueante
      sendCapiEvent({
        eventId: finalEventId,
        eventName: capiEventName,
        planId: plan_id,
        pixelId: pixel_id,
        productId: plan.product_id,
        producerId: product.owner_id,
        clientIp: ip,
        userAgent,
        eventSourceUrl,
        trackingParams: tracking_params,
      }).catch(err => {
        console.error(`[Funnel CAPI] ${capiEventName} failed (non-blocking):`, err)
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in funnel API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
