import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// GET: Gerar certificado/placa em HTML para impressão como PDF
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const badgeType = searchParams.get('badge') || 'iniciante'

  // Buscar conquista
  const { data: achievement, error } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_id', user.id)
    .eq('badge_type', badgeType)
    .single()

  if (error || !achievement) {
    return NextResponse.json({ error: 'Conquista não encontrada' }, { status: 404 })
  }

  // Buscar config do badge
  const { data: badgeConfig } = await supabase
    .from('badge_rewards')
    .select('*')
    .eq('badge_type', badgeType)
    .single()

  // Buscar nome do usuário
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const userName = profile?.full_name || 'Produtor Flowyn'
  const badgeLabel = badgeConfig?.label || 'Vendedor Iniciante'
  const achieveDate = new Date(achievement.achieved_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  // Badge icons unicode
  const badgeIcons: Record<string, string> = {
    iniciante: '🎯',
    vendedor: '⭐',
    top_vendedor: '🏆',
    expert: '🎖️',
    lenda: '👑',
    milionario: '💎',
  }

  const icon = badgeIcons[badgeType] || '🏆'

  // Gerar HTML do certificado
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificado Flowyn - ${badgeLabel}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', sans-serif;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    
    .certificate {
      width: 800px;
      height: 600px;
      background: white;
      border: 3px solid #1a1a1a;
      border-radius: 4px;
      padding: 60px;
      text-align: center;
      position: relative;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    
    .certificate::before {
      content: '';
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
      bottom: 20px;
      border: 1px solid #e5e5e5;
      border-radius: 2px;
    }
    
    .logo {
      font-size: 28px;
      font-weight: 900;
      color: #1a1a1a;
      letter-spacing: -1px;
      margin-bottom: 8px;
    }
    
    .logo span {
      color: #f97316;
    }
    
    .subtitle {
      font-size: 11px;
      font-weight: 600;
      color: #a3a3a3;
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: 40px;
    }
    
    .badge-icon {
      font-size: 72px;
      margin-bottom: 20px;
    }
    
    .badge-title {
      font-size: 32px;
      font-weight: 900;
      color: #1a1a1a;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    
    .description {
      font-size: 14px;
      color: #737373;
      margin-bottom: 32px;
    }
    
    .divider {
      width: 120px;
      height: 2px;
      background: linear-gradient(90deg, #f97316, #f59e0b);
      margin: 0 auto 32px;
    }
    
    .recipient-label {
      font-size: 11px;
      font-weight: 600;
      color: #a3a3a3;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 8px;
    }
    
    .recipient-name {
      font-size: 36px;
      font-weight: 900;
      color: #1a1a1a;
      margin-bottom: 32px;
      letter-spacing: -0.5px;
    }
    
    .achievement-text {
      font-size: 14px;
      color: #525252;
      line-height: 1.6;
      max-width: 500px;
      margin: 0 auto 24px;
    }
    
    .date {
      font-size: 13px;
      color: #737373;
      margin: 0;
    }
    
    .date strong {
      color: #1a1a1a;
    }
    
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 20px;
    }
    
    .signature {
      text-align: center;
    }
    
    .signature-line {
      width: 150px;
      height: 1px;
      background: #e5e5e5;
      margin-bottom: 8px;
    }
    
    .signature-name {
      font-size: 12px;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .signature-role {
      font-size: 10px;
      color: #a3a3a3;
    }
    
    .code {
      font-size: 10px;
      color: #d4d4d4;
      font-family: monospace;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .certificate {
        box-shadow: none;
        border: 2px solid #1a1a1a;
      }
      
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="no-print" style="position: fixed; top: 20px; right: 20px; z-index: 1000;">
    <button onclick="window.print()" style="background: #f97316; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px;">
      🖨️ Imprimir / Salvar PDF
    </button>
  </div>

  <div class="certificate">
    <div>
      <div class="logo">FLOW<span>YN</span></div>
      <div class="subtitle">Certificado de Conquista</div>
      
      <div class="badge-icon">${icon}</div>
      <div class="badge-title">${badgeLabel}</div>
      <div class="description">${badgeConfig?.description || 'Conquista desbloqueada'}</div>
      
      <div class="divider"></div>
      
      <div class="recipient-label">Concedido a</div>
      <div class="recipient-name">${userName}</div>
      
      <div class="achievement-text">
        Pela ${badgeType === 'iniciante' ? 'primeira venda realizada' : `meta de vendas atingida`} na plataforma Flowyn.
        <br>Continue inspirando outros produtores com sua jornada!
      </div>
      
      <div class="date">
        Data: <strong>${achieveDate}</strong>
      </div>
    </div>
    
    <div class="footer">
      <div class="signature">
        <div class="signature-line"></div>
        <div class="signature-name">Equipe Flowyn</div>
        <div class="signature-role">CEO & Fundador</div>
      </div>
      
      <div class="code">
        Código: ${achievement.id.slice(0, 8).toUpperCase()}
      </div>
    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
