import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  console.warn('[Resend] RESEND_API_KEY não configurada — e-mails não serão enviados.')
}

export const resend = new Resend(process.env.RESEND_API_KEY || '')
