import { Resend } from 'resend'

// Lazy initialization — avoids build-time crash when RESEND_API_KEY is not set
let _client: Resend | null = null

export function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Resend] RESEND_API_KEY não configurada — e-mails não serão enviados.')
    return null
  }
  if (!_client) {
    _client = new Resend(process.env.RESEND_API_KEY)
  }
  return _client
}
