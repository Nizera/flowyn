import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(req: NextRequest) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exclusão de Dados — Flowyn</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; color: #1f2937; line-height: 1.6; }
    .container { max-width: 700px; margin: 0 auto; padding: 48px 24px; }
    h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 8px; }
    .subtitle { color: #6b7280; font-size: 0.875rem; margin-bottom: 32px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; margin-bottom: 24px; }
    h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 16px; color: #111827; }
    p { margin-bottom: 12px; color: #374151; }
    ol, ul { margin: 0 0 12px 24px; color: #374151; }
    li { margin-bottom: 8px; }
    .highlight { background: #fff7ed; border-left: 4px solid #f97316; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0; }
    a { color: #ea580c; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .contact { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Exclusão de Dados</h1>
    <p class="subtitle">Flowyn — Plataforma de Pagamento para Infoprodutores</p>

    <div class="card">
      <h2>Como solicitar a exclusão dos seus dados</h2>
      <p>Em conformidade com a Lei Geral de Proteção de Dados (LGPD), você pode solicitar a exclusão dos seus dados pessoais a qualquer momento.</p>

      <div class="highlight">
        <strong>Importante:</strong> Antes de solicitar a exclusão, verifique se não há pendências financeiras ou obrigações legais que impeçam a remoção imediata dos dados.
      </div>

      <h2 style="margin-top: 24px;">Passo a passo</h2>
      <ol>
        <li><strong>Acesse sua conta</strong> na plataforma FlowynPay</li>
        <li>Vá em <strong>Configurações → Minha Conta</strong></li>
        <li>Clique em <strong>&quot;Solicitar exclusão de dados&quot;</strong></li>
        <li>Confirme a solicitação</li>
        <li>Você receberá um e-mail de confirmação</li>
      </ol>

      <p style="margin-top: 16px;">Caso não consiga acessar sua conta, envie uma solicitação por e-mail com os seguintes dados:</p>

      <div class="contact">
        <p><strong>E-mail:</strong> <a href="mailto:contato@flowyn.com.br">contato@flowyn.com.br</a></p>
        <p><strong>Assunto:</strong> Solicitação de exclusão de dados — Flowyn</p>
        <p><strong>Informações necessárias:</strong></p>
        <ul>
          <li>Nome completo</li>
          <li>E-mail da conta</li>
          <li>CPF ou CNPJ</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <h2>O que será excluído</h2>
      <ul>
        <li>Dados de cadastro (nome, e-mail, telefone)</li>
        <li>Dados de CPF/CNPJ</li>
        <li>Tokens de acesso a contas de anúncios (Meta)</li>
        <li>Histórico de navegação na plataforma</li>
        <li>Preferências e configurações</li>
      </ul>

      <h2 style="margin-top: 24px;">O que pode ser mantido</h2>
      <ul>
        <li>Dados de transações financeiras (por obrigação legal — 5 anos)</li>
        <li>Registros de auditoria (por obrigação legal — 2 anos)</li>
      </ul>
    </div>

    <div class="card">
      <h2>Prazo de processamento</h2>
      <p>A exclusão dos dados será processada em até <strong>15 dias úteis</strong> após a confirmação da solicitação. Você receberá um e-mail confirmando a conclusão do processo.</p>
    </div>

    <div class="card">
      <h2>Dúvidas?</h2>
      <p>Em caso de dúvidas sobre a exclusão de dados, entre em contato:</p>
      <ul>
        <li><strong>E-mail:</strong> <a href="mailto:contato@flowyn.com.br">contato@flowyn.com.br</a></li>
        <li><strong>Encarregado de Proteção de Dados:</strong> Daniel Mariano</li>
      </ul>
    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    if (rawBody.length > 4096) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }
    const body = JSON.parse(rawBody)
    const { user_id } = body

    if (!user_id || typeof user_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)) {
      return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: allowed } = await supabase.rpc('consume_rate_limit', {
      requested_bucket: `data_deletion:${user_id}`,
      requested_identifier_hash: user_id,
      max_requests: 5,
      window_seconds: 3600,
    })
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    console.log('[Data Deletion] Request received:', { user_id, timestamp: new Date().toISOString() })

    return NextResponse.json({
      success: true,
      message: 'Solicitação de exclusão recebida. Será processada em até 15 dias úteis.',
      url: 'https://flowyn.com.br/api/meta-ads/data-deletion',
    })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
