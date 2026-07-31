import { getResendClient } from '@/lib/resend'
import { firstSaleCertificateEmail } from '@/lib/email-templates'

interface SendCertificateEmailOpts {
  producerEmail: string
  producerName: string
  certificateUrl: string
  saleAmount: number
}

export async function sendFirstSaleCertificateEmail(opts: SendCertificateEmailOpts) {
  const resend = getResendClient()
  if (!resend) {
    console.warn('[Certificate] Resend não configurado — email não enviado')
    return { success: false, error: 'Email service not configured' }
  }

  const html = firstSaleCertificateEmail({
    producerName: opts.producerName,
    certificateUrl: opts.certificateUrl,
    saleAmount: opts.saleAmount,
  })

  try {
    const { data, error } = await resend.emails.send({
      from: 'Flowyn <noreply@flowyn.com.br>',
      to: opts.producerEmail,
      subject: 'Parabéns! Sua primeira venda na Flowyn',
      html,
    })

    if (error) {
      console.error('[Certificate] Email error:', error)
      return { success: false, error: error.message }
    }

    console.log('[Certificate] Email sent:', data?.id)
    return { success: true, emailId: data?.id }
  } catch (err) {
    console.error('[Certificate] Email send failed:', err)
    return { success: false, error: 'Failed to send email' }
  }
}
