function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

const LOGO_URL = 'https://flowyn.com/brand/logobranca%20transparente.png'
const G = '#f97316'
const DARK_BG = '#0a0a0a'
const CARD_STYLE = `background:${DARK_BG};border-radius:20px;overflow:hidden;max-width:560px;width:100%;`

function emailShell(content: string, title: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" style="${CARD_STYLE}">

          <!-- Logo -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.08);">
              <a href="https://flowyn.com" target="_blank" style="text-decoration:none;">
                <img src="${LOGO_URL}" alt="Flowyn" height="32" style="display:block;height:32px;width:auto;" />
              </a>
            </td>
          </tr>

          ${content}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function emailFooter() {
  return `
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
                &copy; ${new Date().getFullYear()} Flowyn. Todos os direitos reservados.
              </p>
            </td>
          </tr>`
}

export function deliveryEmail(opts: {
  customerName: string
  productName: string
  accessLinks: { label: string; url: string; isFile: boolean }[]
}) {
  const { customerName, productName, accessLinks } = opts
  const safeName = escapeHtml(customerName)
  const safeProduct = escapeHtml(productName)

  const content = `
          <!-- Success Icon -->
          <tr>
            <td align="center" style="padding:40px 40px 0;">
              <div style="width:72px;height:72px;border-radius:50%;background:rgba(249,115,22,0.12);border:2px solid rgba(249,115,22,0.3);display:inline-flex;align-items:center;justify-content:center;font-size:32px;line-height:72px;text-align:center;">
                &#10003;
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
                Ol&aacute;, <strong style="color:#fff;">${safeName}</strong>!
              </p>
              <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 32px;">
                Seu acesso a <strong style="color:#fff;">${safeProduct}</strong> est&aacute; pronto.
                ${accessLinks.length > 0 ? 'Use os bot&otilde;es abaixo para acessar seu conte&uacute;do.' : ''}
              </p>

              ${accessLinks.length > 0 ?
                accessLinks.map(link => `
              <div style="margin-bottom: 12px;">
                <a href="${escapeHtml(link.url)}"
                   style="display:inline-block;background:${G};color:#0a0a0a;font-weight:800;font-size:16px;
                          padding:16px 40px;border-radius:14px;text-decoration:none;letter-spacing:-0.02em;">
                  ${escapeHtml(link.label)}
                </a>
              </div>`).join('')
              : `
              <p style="color:rgba(255,255,255,0.4);font-size:14px;">
                Seu acesso est&aacute; sendo processado. Em caso de d&uacute;vidas, entre em contato pelo suporte.
              </p>`}

              ${accessLinks.some(link => link.isFile) ? `
              <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:20px;">
                &#9888;&#65039; Os links de arquivo expiram em <strong style="color:rgba(255,255,255,0.5);">48 horas</strong>.
                Salve os arquivos ap&oacute;s o download.
              </p>` : ''}
            </td>
          </tr>
          ${emailFooter()}`

  return emailShell(content, `Seu acesso a ${productName}`)
}

export function studentPasswordEmail(opts: {
  customerName: string
  productName: string
  setupUrl: string
  learnUrl: string
  accessLinks?: { label: string; url: string; isFile: boolean }[]
}) {
  const safeCustomer = escapeHtml(opts.customerName)
  const safeProduct = escapeHtml(opts.productName)
  const hasLinks = opts.accessLinks && opts.accessLinks.length > 0

  const content = `
          <tr>
            <td style="padding:36px 40px;text-align:center;">
              <h1 style="color:#fff;font-size:26px;margin:0 0 12px;">Seu acesso est&aacute; pronto</h1>
              <p style="color:rgba(255,255,255,0.58);font-size:15px;line-height:1.65;margin:0 0 24px;">
                Ol&aacute;, <strong style="color:#fff;">${safeCustomer}</strong>. Criamos sua &aacute;rea do aluno para acessar <strong style="color:#fff;">${safeProduct}</strong>.
              </p>
              <a href="${escapeHtml(opts.setupUrl)}" style="display:inline-block;background:${G};color:#0a0a0a;font-weight:800;font-size:16px;padding:16px 34px;border-radius:14px;text-decoration:none;">
                Definir senha e entrar
              </a>
              <p style="color:rgba(255,255,255,0.35);font-size:12px;line-height:1.6;margin:22px 0 0;">
                Se voc&ecirc; j&aacute; definiu sua senha, acesse: <a href="${escapeHtml(opts.learnUrl)}" style="color:${G};">minha &aacute;rea do aluno</a>.
              </p>
              ${hasLinks ? `
              <div style="margin-top:28px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);">
                <p style="color:rgba(255,255,255,0.58);font-size:14px;margin:0 0 16px;">Tamb&eacute;m baixe seus arquivos:</p>
                ${opts.accessLinks!.map(link => `
                <div style="margin-bottom:10px;">
                  <a href="${escapeHtml(link.url)}" style="display:inline-block;background:rgba(255,255,255,0.08);color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;border:1px solid rgba(255,255,255,0.12);">
                    ${escapeHtml(link.label)}
                  </a>
                </div>`).join('')}
                <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:16px 0 0;">
                  &#9888;&#65039; Links de arquivo expiram em 48 horas. Salve ap&oacute;s o download.
                </p>
              </div>` : ''}
            </td>
          </tr>
          ${emailFooter()}`

  return emailShell(content, `Seu acesso a ${opts.productName}`)
}

export function learningNotificationEmail(opts: {
  title: string
  message: string
  actionLabel: string
  actionUrl: string
}) {
  const safeTitle = escapeHtml(opts.title)
  const safeMessage = escapeHtml(opts.message)
  const safeLabel = escapeHtml(opts.actionLabel)

  const content = `
          <tr>
            <td style="padding:36px 40px;text-align:center;">
              <h1 style="color:#fff;font-size:24px;margin:0 0 12px;">${safeTitle}</h1>
              <p style="color:rgba(255,255,255,0.58);font-size:15px;line-height:1.65;margin:0 0 24px;">${safeMessage}</p>
              <a href="${escapeHtml(opts.actionUrl)}" style="display:inline-block;background:${G};color:#0a0a0a;font-weight:800;font-size:15px;padding:14px 30px;border-radius:14px;text-decoration:none;">
                ${safeLabel}
              </a>
            </td>
          </tr>
          ${emailFooter()}`

  return emailShell(content, opts.title)
}

// ── Supabase Auth Email Templates ──

const APP_URL = 'https://flowyn.com'

export function supabaseConfirmSignup() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirme seu cadastro</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" style="${CARD_STYLE}">

          <!-- Logo -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.08);">
              <a href="${APP_URL}" target="_blank" style="text-decoration:none;">
                <img src="${LOGO_URL}" alt="Flowyn" height="32" style="display:block;height:32px;width:auto;" />
              </a>
            </td>
          </tr>

          <!-- Icon -->
          <tr>
            <td align="center" style="padding:40px 40px 0;">
              <div style="width:72px;height:72px;border-radius:50%;background:rgba(249,115,22,0.12);border:2px solid rgba(249,115,22,0.3);display:inline-flex;align-items:center;justify-content:center;font-size:32px;line-height:72px;text-align:center;">
                &#9993;
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <h1 style="color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.04em;margin:0 0 12px;">
                Confirme seu cadastro
              </h1>
              <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 8px;">
                Ol&aacute;!
              </p>
              <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 32px;">
                Voc&ecirc; est&aacute; quase pronto. Clique no bot&atilde;o abaixo para confirmar seu e-mail e ativar sua conta.
              </p>

              <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:${G};color:#0a0a0a;font-weight:800;font-size:16px;padding:16px 40px;border-radius:14px;text-decoration:none;letter-spacing:-0.02em;">
                Confirmar e-mail
              </a>

              <p style="color:rgba(255,255,255,0.35);font-size:12px;line-height:1.6;margin:24px 0 0;">
                Se voc&ecirc; n&atilde;o criou esta conta, pode ignorar este e-mail com seguran&ccedil;a.
              </p>
            </td>
          </tr>

          ${emailFooter()}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function supabaseResetPassword() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recupere sua senha</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" style="${CARD_STYLE}">

          <!-- Logo -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.08);">
              <a href="${APP_URL}" target="_blank" style="text-decoration:none;">
                <img src="${LOGO_URL}" alt="Flowyn" height="32" style="display:block;height:32px;width:auto;" />
              </a>
            </td>
          </tr>

          <!-- Icon -->
          <tr>
            <td align="center" style="padding:40px 40px 0;">
              <div style="width:72px;height:72px;border-radius:50%;background:rgba(249,115,22,0.12);border:2px solid rgba(249,115,22,0.3);display:inline-flex;align-items:center;justify-content:center;font-size:32px;line-height:72px;text-align:center;">
                &#128274;
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <h1 style="color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.04em;margin:0 0 12px;">
                Recupere sua senha
              </h1>
              <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 8px;">
                Ol&aacute;!
              </p>
              <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 32px;">
                Recebemos uma solicita&ccedil;&atilde;o para redefinir a senha da sua conta. Clique no bot&atilde;o abaixo para criar uma nova senha.
              </p>

              <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:${G};color:#0a0a0a;font-weight:800;font-size:16px;padding:16px 40px;border-radius:14px;text-decoration:none;letter-spacing:-0.02em;">
                Redefinir senha
              </a>

              <p style="color:rgba(255,255,255,0.35);font-size:12px;line-height:1.6;margin:24px 0 0;">
                Se voc&ecirc; n&atilde;o solicitou a redefini&ccedil;&atilde;o de senha, pode ignorar este e-mail com seguran&ccedil;a. Sua senha atual permanecer&aacute; inalterada.
              </p>
            </td>
          </tr>

          ${emailFooter()}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
