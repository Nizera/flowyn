import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
  nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
}

interface Skill {
  id: string
  name: string
  slug: string
  description: string | null
  content: string | null
  trigger_type: string
  trigger_config: Record<string, unknown>
  action_type: string
  action_config: Record<string, unknown>
  priority: number
}

// POST /api/wa/agent/process - Processar mensagem com agente IA
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const body = await req.json()
    const { session_id, chat_jid, message, contact_name, product_id } = body

    if (!session_id || !chat_jid || !message) {
      return NextResponse.json(
        { error: 'session_id, chat_jid, and message are required' },
        { status: 400 }
      )
    }

    // Buscar config do agente
    const { data: config, error: configError } = await supabase
      .from('wa_agent_configs')
      .select('*')
      .eq('session_id', session_id)
      .eq('is_enabled', true)
      .single()

    if (configError || !config) {
      return NextResponse.json({
        action: 'reply',
        message: 'Agente não configurado',
      })
    }

    // Buscar skills ativas
    const { data: skills } = await supabase
      .from('wa_skills')
      .select('*')
      .or(`user_id.eq.${config.user_id},is_system.eq.true`)
      .eq('is_enabled', true)
      .order('priority', { ascending: false })

    // Buscar contexto da conversa
    const { data: conversationContext } = await supabase
      .from('wa_conversation_context')
      .select('*')
      .eq('session_id', session_id)
      .eq('chat_jid', chat_jid)
      .single()

    // Detectar skill baseada na mensagem
    const matchedSkill = matchSkill(message, skills || [])

    // Coletar markdown de todas as skills relevantes (matched +始终激活的 skills)
    const skillContents: string[] = []
    if (matchedSkill?.content) {
      skillContents.push(`## Skill Ativa: ${matchedSkill.name}\n\n${matchedSkill.content}`)
    }

    // Adicionar skills始终激活 (greeting, etc) que devem sempre estar no contexto
    const alwaysOnSkills = (skills || []).filter(s =>
      s.content && s.slug !== matchedSkill?.slug &&
      (s.trigger_config as { always_on?: boolean })?.always_on === true
    )
    for (const skill of alwaysOnSkills) {
      skillContents.push(`## Skill: ${skill.name}\n\n${skill.content}`)
    }

    // Buscar skills de produto se tiver product_id
    if (product_id) {
      const { data: product } = await supabase
        .from('products')
        .select('name, description, price')
        .eq('id', product_id)
        .single()

      if (product) {
        skillContents.push(`## Produto Atual\n\nNome: ${product.name}\nDescrição: ${product.description || 'N/A'}\nPreço: R$ ${product.price}`)
      }
    }

    // Chamar LLM com contexto das skills
    const llmResponse = await callLLM(config, {
      message,
      contact_name,
      conversation_history: conversationContext?.context?.history || [],
      skill_context: skillContents.length > 0 ? skillContents.join('\n\n---\n\n') : null,
      matched_skill: matchedSkill?.slug || null,
    })

    // Atualizar contexto
    await supabase
      .from('wa_conversation_context')
      .upsert({
        session_id,
        chat_jid,
        last_skill_used: matchedSkill?.slug || null,
        last_intent: llmResponse.intent || null,
        messages_count: (conversationContext?.messages_count || 0) + 1,
      }, { onConflict: 'session_id,chat_jid' })

    return NextResponse.json({
      ...llmResponse,
      skill_used: matchedSkill?.slug || null,
    })
  } catch (error) {
    console.error('[WA Agent Process] error:', error)
    return NextResponse.json(
      { action: 'reply', message: 'Erro ao processar mensagem' },
      { status: 500 }
    )
  }
}

function matchSkill(message: string, skills: Skill[]): Skill | null {
  const lowerMessage = message.toLowerCase()

  for (const skill of skills) {
    const config = skill.trigger_config

    if (skill.trigger_type === 'keyword') {
      const keywords = (config as { keywords?: string[] }).keywords || []
      if (keywords.some(k => lowerMessage.includes(k.toLowerCase()))) {
        return skill
      }
    }

    if (skill.trigger_type === 'intent') {
      const intents = (config as { intents?: string[] }).intents || []
      // Simple intent matching - in production, use NLP
      const intentMap: Record<string, string[]> = {
        greeting: ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi'],
        buy: ['comprar', 'quero', 'adquirir', 'pix', 'pagar', 'pay', 'buy'],
        payment_status: ['paguei', 'confirmado', 'status', 'pagamento', 'paid'],
        human: ['atendente', 'humano', 'suporte', 'pessoa', 'attendant'],
      }

      for (const intent of intents) {
        const keywords = intentMap[intent] || []
        if (keywords.some(k => lowerMessage.includes(k))) {
          return skill
        }
      }
    }
  }

  return null
}

async function executeSkill(
  skill: Skill,
  context: {
    session_id: string
    chat_jid: string
    message: string
    contact_name?: string
    product_id?: string
    user_id: string
    supabase: any
  }
): Promise<{ action: string; message?: string; [key: string]: unknown }> {
  switch (skill.action_type) {
    case 'message': {
      const actionConfig = skill.action_config as { message?: string; use_product_context?: boolean; use_faq_context?: boolean }
      let responseMessage = actionConfig.message || 'Mensagem padrão'

      if (actionConfig.use_product_context && context.product_id) {
        // Buscar info do produto
        const { data: product } = await context.supabase
          .from('products')
          .select('name, description, price')
          .eq('id', context.product_id)
          .single()

        if (product) {
          responseMessage = `📦 *${product.name}*\n\n${product.description || ''}\n\n💰 Valor: R$ ${product.price}`
        }
      }

      return { action: 'reply', message: responseMessage }
    }

    case 'pix': {
      const actionConfig = skill.action_config as { value?: number; description?: string }
      return {
        action: 'pix',
        message: 'Vou gerar o PIX para você. Aguarde um momento.',
        pix_data: {
          value: actionConfig.value || 0,
          description: actionConfig.description || 'Pagamento via WhatsApp',
          product_id: context.product_id,
        },
      }
    }

    case 'checkout': {
      const actionConfig = skill.action_config as { base_url?: string }
      const baseUrl = actionConfig.base_url || process.env.NEXT_PUBLIC_APP_URL || 'https://flowyn.com.br'
      return {
        action: 'checkout',
        message: 'Segue o link para pagamento:',
        checkout_url: `${baseUrl}/checkout/${context.product_id || ''}`,
      }
    }

    case 'transfer': {
      const actionConfig = skill.action_config as { reason?: string }
      return {
        action: 'transfer',
        message: 'Vou transferir para um atendente humano. Aguarde um momento.',
        transfer_reason: actionConfig.reason || 'Solicitação do cliente',
      }
    }

    default:
      return { action: 'reply', message: (skill.action_config as { message?: string })?.message || 'Ação não implementada' }
  }
}

async function callLLM(
  config: {
    provider: string
    api_key: string | null
    model: string
    api_url: string | null
    system_prompt: string | null
    max_tokens: number
    temperature: number
    fallback_message: string
  },
  context: {
    message: string
    contact_name?: string
    conversation_history: Array<{ role: string; content: string }>
    skill_context?: string | null
    matched_skill?: string | null
  }
): Promise<{ action: string; message: string; intent?: string }> {
  if (!config.api_key) {
    return {
      action: 'reply',
      message: config.fallback_message,
    }
  }

  const basePrompt = config.system_prompt || 'Você é um assistente de vendas via WhatsApp. Responda de forma friendly e objetiva em português brasileiro.'

  // Montar system prompt com contexto das skills
  let systemPrompt = basePrompt

  if (context.skill_context) {
    systemPrompt = `${basePrompt}

---SKILLS DISPONÍVEIS---

Leia e siga as instruções abaixo cuidadosamente. Elas definem como você deve se comportar nesta conversa:

${context.skill_context}

---FIM DAS SKILLS---

Responda ao cliente seguindo fielmente as instruções acima. Seja natural e humanizado.`
  }

  const contactInfo = context.contact_name ? `\n\nNome do contato: ${context.contact_name}` : ''

  const messages = [
    { role: 'system', content: systemPrompt },
    ...context.conversation_history.slice(-10),
    { role: 'user', content: context.message + contactInfo },
  ]

  try {
    const endpoint = config.api_url || PROVIDER_ENDPOINTS[config.provider] || PROVIDER_ENDPOINTS.openai

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.max_tokens,
        temperature: config.temperature,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error('[WA Agent] LLM error:', response.status)
      return {
        action: 'reply',
        message: config.fallback_message,
      }
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || data.content?.[0]?.text || config.fallback_message

    // Detectar intenção da resposta
    const intent = detectIntent(reply)

    return {
      action: 'reply',
      message: reply,
      intent: intent ?? undefined,
    }
  } catch (error) {
    console.error('[WA Agent] LLM call error:', error)
    return {
      action: 'reply',
      message: config.fallback_message,
    }
  }
}

function detectIntent(text: string): string | null {
  const lowerText = text.toLowerCase()

  if (lowerText.includes('pix') || lowerText.includes('pagamento')) return 'payment'
  if (lowerText.includes('comprar') || lowerText.includes('adquirir')) return 'purchase'
  if (lowerText.includes('atendente') || lowerText.includes('humano')) return 'transfer'
  if (lowerText.includes('obrigado') || lowerText.includes('agradeco')) return 'thanks'

  return null
}
