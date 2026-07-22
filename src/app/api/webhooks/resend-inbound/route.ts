import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text()

    const id = req.headers.get('svix-id')
    const timestamp = req.headers.get('svix-timestamp')
    const signature = req.headers.get('svix-signature')

    if (!id || !timestamp || !signature) {
      return new NextResponse('Missing headers', { status: 400 })
    }

    const secret = process.env.RESEND_WEBHOOK_SECRET
    if (!secret) {
      console.error('RESEND_WEBHOOK_SECRET not set')
      return new NextResponse('Server misconfigured', { status: 500 })
    }

    const result = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    })

    if (result.type !== 'email.received') {
      return NextResponse.json({ message: 'Ignored' }, { status: 200 })
    }

    const emailId = result.data?.email_id
    if (!emailId) {
      return new NextResponse('Missing email_id', { status: 400 })
    }

    const { data: email, error: fetchError } =
      await resend.emails.receiving.get(emailId)

    if (fetchError || !email) {
      console.error('Failed to fetch inbound email:', fetchError)
      return new NextResponse('Error fetching email', { status: 500 })
    }

    const from = email.from || 'desconhecido'
    const subject = email.subject || '(sem assunto)'

    const { error: sendError } = await resend.emails.send({
      from: 'Flowyn <suporte@flowyn.com.br>',
      to: ['nizeragg@gmail.com'],
      subject: `[FWD] ${subject}`,
      html: email.html || `<pre>${email.text || ''}</pre>`,
      text: email.text,
      replyTo: from,
    })

    if (sendError) {
      console.error('Failed to forward:', sendError)
      return new NextResponse('Error forwarding', { status: 500 })
    }

    return NextResponse.json({ message: 'Forwarded' })
  } catch (error) {
    console.error('Inbound webhook error:', error)
    return new NextResponse('Error', { status: 500 })
  }
}
