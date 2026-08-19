-- ============================================
-- Migration: Tabelas do Agente IA WhatsApp
-- Data: 20/08/2026
-- ============================================

-- ============================================
-- TABELA: wa_agent_configs
-- Configuração do agente IA por produtor
-- ============================================
CREATE TABLE IF NOT EXISTS wa_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  provider TEXT NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai', 'anthropic', 'google', 'nvidia', 'custom')),
  api_key TEXT,
  model TEXT NOT NULL DEFAULT 'gpt-4o',
  api_url TEXT,
  system_prompt TEXT,
  max_tokens INT NOT NULL DEFAULT 1024,
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  fallback_message TEXT DEFAULT 'Desculpe, não consegui processar. Um atendente humano irá ajudá-lo.',
  human_handoff_message TEXT DEFAULT 'Vou transferir para um atendente humano. Aguarde um momento.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- ============================================
-- TABELA: wa_skills
-- Skills disponíveis (padrão + customizáveis)
-- ============================================
CREATE TABLE IF NOT EXISTS wa_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  trigger_type TEXT NOT NULL DEFAULT 'keyword' CHECK (trigger_type IN ('keyword', 'intent', 'regex', 'manual')),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action_type TEXT NOT NULL DEFAULT 'message' CHECK (action_type IN ('message', 'pix', 'checkout', 'webhook', 'transfer', 'custom')),
  action_config JSONB NOT NULL DEFAULT '{}',
  priority INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- ============================================
-- TABELA: wa_skill_products
-- Associação skill → produto
-- ============================================
CREATE TABLE IF NOT EXISTS wa_skill_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES wa_skills(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(skill_id, product_id)
);

-- ============================================
-- TABELA: wa_conversation_context
-- Contexto da conversa para o agente
-- ============================================
CREATE TABLE IF NOT EXISTS wa_conversation_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
  chat_jid TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  last_skill_used TEXT,
  last_intent TEXT,
  messages_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, chat_jid)
);

-- ============================================
-- Habilitar RLS
-- ============================================
ALTER TABLE wa_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_skill_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_conversation_context ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Políticas RLS
-- ============================================

-- wa_agent_configs
CREATE POLICY "Users can view own agent configs" ON wa_agent_configs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own agent configs" ON wa_agent_configs
  FOR ALL USING (auth.uid() = user_id);

-- wa_skills
CREATE POLICY "Users can view own skills" ON wa_skills
  FOR SELECT USING (auth.uid() = user_id OR is_system = true);

CREATE POLICY "Users can manage own skills" ON wa_skills
  FOR ALL USING (auth.uid() = user_id AND is_system = false);

-- wa_skill_products
CREATE POLICY "Users can view own skill products" ON wa_skill_products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wa_skills
      WHERE wa_skills.id = wa_skill_products.skill_id
      AND wa_skills.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own skill products" ON wa_skill_products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM wa_skills
      WHERE wa_skills.id = wa_skill_products.skill_id
      AND wa_skills.user_id = auth.uid()
    )
  );

-- wa_conversation_context
CREATE POLICY "Users can view own conversation context" ON wa_conversation_context
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wa_sessions
      WHERE wa_sessions.id = wa_conversation_context.session_id
      AND wa_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage conversation context" ON wa_conversation_context
  FOR ALL USING (true);

-- ============================================
-- Triggers
-- ============================================
CREATE TRIGGER set_wa_agent_configs_updated_at
  BEFORE UPDATE ON wa_agent_configs
  FOR EACH ROW EXECUTE FUNCTION update_wa_updated_at();

CREATE TRIGGER set_wa_skills_updated_at
  BEFORE UPDATE ON wa_skills
  FOR EACH ROW EXECUTE FUNCTION update_wa_updated_at();

CREATE TRIGGER set_wa_conversation_context_updated_at
  BEFORE UPDATE ON wa_conversation_context
  FOR EACH ROW EXECUTE FUNCTION update_wa_updated_at();

-- ============================================
-- Índices
-- ============================================
CREATE INDEX idx_wa_agent_configs_user ON wa_agent_configs(user_id);
CREATE INDEX idx_wa_agent_configs_session ON wa_agent_configs(session_id);
CREATE INDEX idx_wa_skills_user ON wa_skills(user_id);
CREATE INDEX idx_wa_skills_slug ON wa_skills(user_id, slug);
CREATE INDEX idx_wa_conversation_context_chat ON wa_conversation_context(session_id, chat_jid);

-- ============================================
-- Permissões
-- ============================================
GRANT ALL ON wa_agent_configs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_agent_configs TO authenticated;

GRANT ALL ON wa_skills TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_skills TO authenticated;

GRANT ALL ON wa_skill_products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_skill_products TO authenticated;

GRANT ALL ON wa_conversation_context TO service_role;
GRANT SELECT ON wa_conversation_context TO authenticated;

-- ============================================
-- Skills padrão (system skills)
-- ============================================
INSERT INTO wa_skills (name, slug, description, is_system, trigger_type, trigger_config, action_type, action_config, priority)
VALUES
  (
    'Saudação',
    'greeting',
    'Mensagem de boas-vindas quando o cliente entra em contato',
    true,
    'intent',
    '{"intents": ["greeting", "hello", "hi"]}',
    'message',
    '{"message": "Olá! Bem-vindo! Como posso ajudá-lo hoje?"}',
    100
  ),
  (
    'Informações do Produto',
    'product_info',
    'Compartilha informações sobre produtos',
    true,
    'keyword',
    '{"keywords": ["produto", "preço", "quanto", "custa", "valor", "plano"]}',
    'message',
    '{"use_product_context": true}',
    90
  ),
  (
    'Gerar PIX',
    'generate_pix',
    'Gera PIX para pagamento via WhatsApp',
    true,
    'intent',
    '{"intents": ["buy", "purchase", "pix", "pay", "comprar", "pagar"]}',
    'pix',
    '{"ask_value": true}',
    80
  ),
  (
    'Verificar Pagamento',
    'check_payment',
    'Verifica status do pagamento',
    true,
    'intent',
    '{"intents": ["payment_status", "paid", "confirmed", "paguei", "confirmado", "status"]}',
    'webhook',
    '{"action": "check_payment"}',
    70
  ),
  (
    'Enviar Checkout',
    'send_checkout',
    'Envia link de checkout',
    true,
    'keyword',
    '{"keywords": ["link", "checkout", "site", "comprar no site"]}',
    'checkout',
    '{}',
    60
  ),
  (
    'Handoff para Humano',
    'human_handoff',
    'Transfere para atendente humano',
    true,
    'intent',
    '{"intents": ["human", "agent", "attendant", "humano", "atendente", "suporte"]}',
    'transfer',
    '{}',
    50
  ),
  (
    'Perguntas Frequentes',
    'faq',
    'Responde perguntas frequentes',
    true,
    'intent',
    '{"intents": ["faq", "question", "doubt", "pergunta", "dúvida"]}',
    'message',
    '{"use_faq_context": true}',
    40
  )
ON CONFLICT (user_id, slug) DO NOTHING;
