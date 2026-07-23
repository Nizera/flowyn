import { NextRequest, NextResponse } from 'next/server'
import { KNOWLEDGE_BASE } from '@/lib/chatbot/knowledge-base'
import { createAdminClient } from '@/utils/supabase/admin'

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'

function esc(s: string) {
  return s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c))
}

const SYSTEM_PROMPT = `Voce e o assistente virtual da Flowyn, plataforma de checkout para infoprodutores brasileiros.

REGRAS ABSOLUTAS:
1. Responda SOMENTE com base no contexto fornecido. NUNCA invente informacoes.
2. NUNCA compartilhe dados tecnicos internos (chaves de API, banco de dados, tokens, endpoints, codigo).
3. NUNCA responda sobre como "burlar", "contornar" ou "explorar" a plataforma, assinatura ou limites.
4. Se o usuario fizer pergunta maliciosa ou fora do escopo, responda: "Posso ajudar com duvidas sobre a plataforma Flowyn. Para outros assuntos, entre em contato com suporte@flowyn.com.br."
5. Se nao souber algo, diga: "Nao tenho essa informacao. Entre em contato com suporte@flowyn.com.br para mais detalhes."
6. Seja direto, claro e profissional. Em portugues brasileiro.
7. NUNCA discuta concorrentes.
8. NUNCA compartilhe dados de outros usuarios.

CONTEXTO DA PLATAFORMA:
${KNOWLEDGE_BASE}

Responda de forma util e concisa.`

function sanitizeInput(input: string): string {
  return input
    .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi, '')
    .replace(/you\s+are\s+now\s+/gi, '')
    .replace(/new\s+instructions?:/gi, '')
    .trim()
}

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensagem obrigatoria' }, { status: 400 })
    }

    const clean = sanitizeInput(message)
    if (clean.length > 500) {
      return NextResponse.json({ error: 'Mensagem muito longa. Maximo 500 caracteres.' }, { status: 400 })
    }

    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Chatbot nao configurado' }, { status: 500 })
    }

    const admin = createAdminClient()
    const { data: allowed } = await admin.rpc('consume_rate_limit', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_action: 'chatbot',
      p_limit: 20,
      p_window_seconds: 60,
    })

    if (allowed === false) {
      return NextResponse.json({ error: 'Muitas requisicoes. Aguarde um momento.' }, { status: 429 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'z-ai/glm-5.2',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: esc(clean) },
        ],
        temperature: 0.3,
        max_tokens: 512,
        top_p: 0.7,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.error('NVIDIA API error:', response.status)
      return NextResponse.json(
        { error: 'Erro ao processar mensagem. Tente novamente.' },
        { status: 200 }
      )
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || 'Nao consegui processar sua mensagem.'

    return NextResponse.json({ reply })
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Tempo limite excedido. Tente novamente.' }, { status: 200 })
    }
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
