import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const subject = formData.get('subject') as string
    const message = formData.get('message') as string

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Campos obrigatórios não preenchidos' }, { status: 400 })
    }

    const labels: Record<string, string> = {
      suporte: 'Suporte Técnico',
      financeiro: 'Financeiro / Pagamentos',
      parceria: 'Parceria',
      outro: 'Outro',
    }

    await resend.emails.send({
      from: 'Flowyn <suporte@flowyn.com.br>',
      to: ['nizeragg@gmail.com'],
      subject: `[Contato] ${labels[subject] || subject} — ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#f97316;">Nova mensagem de contato</h2>
          <p><strong>Nome:</strong> ${name}</p>
          <p><strong>E-mail:</strong> ${email}</p>
          <p><strong>Categoria:</strong> ${labels[subject] || subject}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
          <p style="white-space:pre-wrap;">${message}</p>
        </div>
      `,
      replyTo: email,
    })

    return NextResponse.json({ message: 'Mensagem enviada com sucesso' })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json({ error: 'Erro ao enviar mensagem' }, { status: 500 })
  }
}
