function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

export function deliveryEmail(opts: {
  customerName: string
  productName: string
  accessLinks: { label: string; url: string; isFile: boolean }[]
}) {
  const { customerName, productName, accessLinks } = opts
  const safeName = escapeHtml(customerName)
  const safeProduct = escapeHtml(productName)
  const G = '#f97316'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Seu acesso a ${safeProduct}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:20px;overflow:hidden;max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.08);">
              <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.04em;">
                Flo<span style="color:${G}">wyn</span>
              </span>
            </td>
          </tr>

          <!-- Success Icon -->
          <tr>
            <td align="center" style="padding:40px 40px 0;">
              <div style="width:72px;height:72px;border-radius:50%;background:rgba(249,115,22,0.12);border:2px solid rgba(249,115,22,0.3);display:inline-flex;align-items:center;justify-content:center;font-size:32px;line-height:72px;text-align:center;">
                ✅
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <h1 style="color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.04em;margin:0 0 12px;">
                Compra confirmada!
              </h1>
              <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 8px;">
                Olá, <strong style="color:#fff;">${safeName}</strong>!
              </p>
              <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 32px;">
                Seu acesso a <strong style="color:#fff;">${safeProduct}</strong> está pronto.
                ${accessLinks.length > 0 ? 'Use os botões abaixo para acessar seu conteúdo.' : ''}
              </p>

              ${accessLinks.length > 0 ? 
                accessLinks.map(link => `
                  <div style="margin-bottom: 12px;">
                    <a href="${escapeHtml(link.url)}"
                       style="display:inline-block;background:${G};color:#0a0a0a;font-weight:800;font-size:16px;
                              padding:16px 40px;border-radius:14px;text-decoration:none;letter-spacing:-0.02em;">
                      ${escapeHtml(link.label)}
                    </a>
                  </div>
                `).join('')
              : `
              <p style="color:rgba(255,255,255,0.4);font-size:14px;">
                Seu acesso está sendo processado. Em caso de dúvidas, entre em contato pelo suporte.
              </p>
              `}

              ${accessLinks.some(link => link.isFile) ? `
              <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:20px;">
                ⚠️ Os links de arquivo expiram em <strong style="color:rgba(255,255,255,0.5);">48 horas</strong>.
                Salve os arquivos após o download.
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="color:rgba(255,255,255,0.25);font-size:12px;margin:0 0 4px;">
                Você recebeu este e-mail porque realizou uma compra na plataforma Flowyn.
              </p>
              <p style="color:rgba(255,255,255,0.15);font-size:11px;margin:0;">
                © ${new Date().getFullYear()} Flowyn. Todos os direitos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function studentPasswordEmail(opts: {
  customerName: string
  productName: string
  setupUrl: string
  learnUrl: string
}) {
  const G = '#f97316'
  const safeCustomer = escapeHtml(opts.customerName)
  const safeProduct = escapeHtml(opts.productName)
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:20px;overflow:hidden;max-width:560px;width:100%;">
        <tr><td style="padding:32px 40px 20px;border-bottom:1px solid rgba(255,255,255,0.08);">
          <span style="font-size:22px;font-weight:800;color:#fff;">Flo<span style="color:${G}">wyn</span></span>
        </td></tr>
        <tr><td style="padding:36px 40px;text-align:center;">
          <h1 style="color:#fff;font-size:26px;margin:0 0 12px;">Seu acesso está pronto</h1>
          <p style="color:rgba(255,255,255,0.58);font-size:15px;line-height:1.65;margin:0 0 24px;">
            Olá, <strong style="color:#fff;">${safeCustomer}</strong>. Criamos sua área do aluno para acessar <strong style="color:#fff;">${safeProduct}</strong>.
          </p>
          <a href="${escapeHtml(opts.setupUrl)}" style="display:inline-block;background:${G};color:#0a0a0a;font-weight:800;font-size:16px;padding:16px 34px;border-radius:14px;text-decoration:none;">
            Definir senha e entrar
          </a>
          <p style="color:rgba(255,255,255,0.35);font-size:12px;line-height:1.6;margin:22px 0 0;">
            Se você já definiu sua senha, acesse: <a href="${escapeHtml(opts.learnUrl)}" style="color:${G};">minha área do aluno</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function learningNotificationEmail(opts: {
  title: string
  message: string
  actionLabel: string
  actionUrl: string
}) {
  const G = '#f97316'
  const safeTitle = escapeHtml(opts.title)
  const safeMessage = escapeHtml(opts.message)
  const safeLabel = escapeHtml(opts.actionLabel)
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:20px;overflow:hidden;max-width:560px;width:100%;">
        <tr><td style="padding:32px 40px 20px;border-bottom:1px solid rgba(255,255,255,0.08);">
          <span style="font-size:22px;font-weight:800;color:#fff;">Flo<span style="color:${G}">wyn</span></span>
        </td></tr>
        <tr><td style="padding:36px 40px;text-align:center;">
          <h1 style="color:#fff;font-size:24px;margin:0 0 12px;">${safeTitle}</h1>
          <p style="color:rgba(255,255,255,0.58);font-size:15px;line-height:1.65;margin:0 0 24px;">${safeMessage}</p>
          <a href="${escapeHtml(opts.actionUrl)}" style="display:inline-block;background:${G};color:#0a0a0a;font-weight:800;font-size:15px;padding:14px 30px;border-radius:14px;text-decoration:none;">
            ${safeLabel}
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
