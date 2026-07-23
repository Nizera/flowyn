import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { verifyOrigin } from '@/lib/csrf'
import { createAdminClient } from '@/utils/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)

const VALID_SUBJECTS = ['suporte', 'financeiro', 'parceria', 'outro']
const SUBJECT_LABELS: Record<string, string> = {
  suporte: 'Suporte Tecnico',
  financeiro: 'Financeiro / Pagamentos',
  parceria: 'Parceria',
  outro: 'Outro',
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function POST(req: NextRequest) {
  const csrfError = verifyOrigin(req)
  if (csrfError) return csrfError

  try {
    const formData = await req.formData()
    const name = String(formData.get('name') || '').trim()
    const email = String(formData.get('email') || '').trim()
    const subject = String(formData.get('subject') || '')
    const message = String(formData.get('message') || '').trim()

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Campos obrigatorios nao preenchidos' }, { status: 400 })
    }

    if (name.length > 200 || message.length > 5000) {
      return NextResponse.json({ error: 'Dados excedem limite permitido' }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email invalido' }, { status: 400 })
    }

    if (!VALID_SUBJECTS.includes(subject)) {
      return NextResponse.json({ error: 'Assunto invalido' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: allowed } = await admin.rpc('consume_rate_limit', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_action: 'contact_form',
      p_limit: 5,
      p_window_seconds: 300,
    })

    if (allowed === false) {
      return NextResponse.json({ error: 'Muitas requisicoes. Aguarde alguns minutos.' }, { status: 429 })
    }

    const recipient = process.env.CONTACT_RECIPIENT_EMAIL || 'nizeragg@gmail.com'

    await resend.emails.send({
      from: 'Flowyn <suporte@flowyn.com.br>',
      to: [recipient],
      subject: `[Contato] ${SUBJECT_LABELS[subject]} — ${esc(name)}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#f97316;">Nova mensagem de contato</h2>
          <p><strong>Nome:</strong> ${esc(name)}</p>
          <p><strong>Email:</strong> ${esc(email)}</p>
          <p><strong>Categoria:</strong> ${esc(SUBJECT_LABELS[subject])}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
          <p style="white-space:pre-wrap;">${esc(message)}</p>
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
