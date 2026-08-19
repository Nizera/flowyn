import { config } from '../config'
import { createChildLogger } from '../lib/logger'

const log = createChildLogger('webhook')

interface WebhookPayload {
  event: string
  sessionId: string
  userId: string
  [key: string]: any
}

export async function callFlowynWebhook(payload: WebhookPayload) {
  const url = `${config.flowyn.url}/api/wa/webhook`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.worker.secret}`,
      },
      body: JSON.stringify({
        type: payload.event,
        data: payload,
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      log.error({ status: res.status, event: payload.event }, 'Webhook call failed')
      return false
    }

    log.debug({ event: payload.event }, 'Webhook sent successfully')
    return true
  } catch (err) {
    log.error(err, 'Webhook call error')
    return false
  }
}
