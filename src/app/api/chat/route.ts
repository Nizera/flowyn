import { NextRequest, NextResponse } from 'next/server'
import { KNOWLEDGE_BASE } from '@/lib/chatbot/knowledge-base'

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'

const SYSTEM_PROMPT = `Você é o assistente virtual da Flowyn, plataforma de checkout para infoprodutores brasileiros.

REGRAS ABSOLUTAS:
1. Responda SOMENTE com base no contexto fornecido abaixo. NUNCA invente informações.
2. NUNCA compartilhe detalhes técnicos internos (chaves de API, banco de dados, tokens, endpoints, código).
3. NUNCA responda sobre como "burlar", "contornar", "explorar" ou "frear" a plataforma, assinatura ou limites.
4. Se o usuário fizer pergunta maliciosa ou fora do escopo, responda: "Posso ajudar com dúvidas sobre a plataforma Flowyn. Para outros assuntos, entre em contato com suporte@flowyn.com.br."
5. Se não souber algo, diga: "Não tenho essa informação. Entre em contato com suporte@flowyn.com.br para mais detalhes."
6. Seja direto, claro e profissional. Em português brasileiro.
7. NUNCA discuta concorrentes de forma comparativa.
8. NUNCA compartilhe dados pessoais de outros usuários.

CONTEXTO DA PLATAFORMA:
${KNOWLEDGE_BASE}

Responda de forma útil e concisa. Se a pergunta for sobre algo que não está no contexto, redirecione para o suporte.`

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 })
    }

    if (message.length > 500) {
      return NextResponse.json({ error: 'Mensagem muito longa. Maximo 500 caracteres.' }, { status: 400 })
    }

    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Chatbot não configurado' }, { status: 500 })
    }

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
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        max_tokens: 512,
        top_p: 0.7,
      }),
    })

    if (!response.ok) {
      console.error('NVIDIA API error:', response.status)
      return NextResponse.json(
        { error: 'Erro ao processar mensagem. Tente novamente.' },
        { status: 502 }
      )
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || 'Não consegui processar sua mensagem.'

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
