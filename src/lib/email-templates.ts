export function deliveryEmail(opts: {
  customerName: string
  productName: string
  accessLink: string | null
  isFile: boolean
}) {
  const { customerName, productName, accessLink, isFile } = opts
  const G = '#00e88a'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Seu acesso a ${productName}</title>
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
              <div style="width:72px;height:72px;border-radius:50%;background:rgba(0,232,138,0.12);border:2px solid rgba(0,232,138,0.3);display:inline-flex;align-items:center;justify-content:center;font-size:32px;line-height:72px;text-align:center;">
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
                Olá, <strong style="color:#fff;">${customerName}</strong>!
              </p>
              <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 32px;">
                Seu acesso a <strong style="color:#fff;">${productName}</strong> está pronto.
                ${isFile ? 'Clique no botão abaixo para baixar seu arquivo.' : 'Use o link abaixo para acessar o conteúdo.'}
              </p>

              ${accessLink ? `
              <a href="${accessLink}"
                 style="display:inline-block;background:${G};color:#0a0a0a;font-weight:800;font-size:16px;
                        padding:16px 40px;border-radius:14px;text-decoration:none;letter-spacing:-0.02em;">
                ${isFile ? '📥 Baixar Agora' : '🔓 Acessar Conteúdo'}
              </a>
              ` : `
              <p style="color:rgba(255,255,255,0.4);font-size:14px;">
                Seu acesso está sendo processado. Em caso de dúvidas, entre em contato pelo suporte.
              </p>
              `}

              ${accessLink && isFile ? `
              <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:20px;">
                ⚠️ Este link expira em <strong style="color:rgba(255,255,255,0.5);">48 horas</strong>.
                Salve o arquivo após o download.
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
