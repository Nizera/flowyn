-- ============================================
-- Migration: Adicionar tabelas WhatsApp CRM
-- Projeto: saasnex (nehoyrpmapzhecxhyvvd)
-- Data: 20/08/2026
-- ============================================

-- ============================================
-- Função para atualizar updated_at automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_wa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TABELA: wa_sessions
-- Conexões WhatsApp (multi-número)
-- ============================================
CREATE TABLE IF NOT EXISTS wa_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'qr_pending', 'connected')),
  jid TEXT,
  integration_token TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#25D366',
  is_default BOOLEAN NOT NULL DEFAULT false,
  allow_groups BOOLEAN NOT NULL DEFAULT false,
  queue_id TEXT,
  greeting_message TEXT,
  completion_message TEXT,
  out_of_hours_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABELA: wa_messages
-- Mensagens do chat
-- ============================================
CREATE TABLE IF NOT EXISTS wa_messages (
  id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
  chat_jid TEXT NOT NULL,
  from_jid TEXT NOT NULL,
  to_jid TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact')),
  media_url TEXT,
  media_mime TEXT,
  file_name TEXT,
  file_size BIGINT,
  quoted_id TEXT,
  sender_name TEXT,
  is_from_me BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, id)
);

-- ============================================
-- TABELA: wa_contacts
-- Contatos sincronizados do WhatsApp
-- ============================================
CREATE TABLE IF NOT EXISTS wa_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  push_name TEXT,
  avatar_url TEXT,
  email TEXT,
  tags TEXT[] DEFAULT '{}',
  is_group BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, phone)
);

-- ============================================
-- TABELA: wa_chats
-- Metadados das conversas
-- ============================================
CREATE TABLE IF NOT EXISTS wa_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
  chat_jid TEXT NOT NULL,
  name TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'open', 'closed', 'group')),
  assigned_user_id UUID REFERENCES auth.users(id),
  queue_id TEXT,
  last_message TEXT,
  last_message_at BIGINT,
  unread_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, chat_jid)
);

-- ============================================
-- TABELA: wa_queues
-- Filas de atendimento
-- ============================================
CREATE TABLE IF NOT EXISTS wa_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#25D366',
  distribution TEXT NOT NULL DEFAULT 'manual' CHECK (distribution IN ('manual', 'round-robin')),
  max_load INT NOT NULL DEFAULT 10,
  greeting_message TEXT,
  out_of_hours_message TEXT,
  business_hours JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABELA: wa_queue_members
-- Membros das filas (agentes)
-- ============================================
CREATE TABLE IF NOT EXISTS wa_queue_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES wa_queues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_load INT NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(queue_id, user_id)
);

-- ============================================
-- TABELA: wa_chat_events
-- Eventos do ciclo de vida
-- ============================================
CREATE TABLE IF NOT EXISTS wa_chat_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
  chat_jid TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('created', 'opened', 'closed', 'reassigned', 'transferred', 'note')),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  detail TEXT,
  ts BIGINT NOT NULL
);

-- ============================================
-- TABELA: wa_ratings
-- Pesquisas de satisfação (CSAT)
-- ============================================
CREATE TABLE IF NOT EXISTS wa_ratings (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
  chat_jid TEXT NOT NULL,
  score INT NOT NULL CHECK (score IN (1, 2, 3)),
  reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABELA: wa_quick_replies
-- Respostas rápidas (/atalhos)
-- ============================================
CREATE TABLE IF NOT EXISTS wa_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shortcut TEXT NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, shortcut)
);

-- ============================================
-- TABELA: wa_tags
-- Tags para contatos
-- ============================================
CREATE TABLE IF NOT EXISTS wa_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- ============================================
-- TABELA: wa_scheduled_messages
-- Mensagens agendadas
-- ============================================
CREATE TABLE IF NOT EXISTS wa_scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
  to_jid TEXT NOT NULL,
  body TEXT NOT NULL,
  media_url TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Índices para performance
-- ============================================
CREATE INDEX idx_wa_messages_chat ON wa_messages(session_id, chat_jid, timestamp DESC);
CREATE INDEX idx_wa_messages_status ON wa_messages(session_id, status);
CREATE INDEX idx_wa_messages_from_me ON wa_messages(session_id, is_from_me);
CREATE INDEX idx_wa_chats_status ON wa_chats(session_id, status);
CREATE INDEX idx_wa_chats_assigned ON wa_chats(assigned_user_id, status);
CREATE INDEX idx_wa_chats_queue ON wa_chats(queue_id, status);
CREATE INDEX idx_wa_contacts_phone ON wa_contacts(user_id, phone);
CREATE INDEX idx_wa_contacts_name ON wa_contacts(user_id, name);
CREATE INDEX idx_wa_chat_events_chat ON wa_chat_events(session_id, chat_jid, ts);
CREATE INDEX idx_wa_chat_events_kind ON wa_chat_events(session_id, kind);
CREATE INDEX idx_wa_ratings_session ON wa_ratings(session_id, created_at DESC);
CREATE INDEX idx_wa_quick_replies_user ON wa_quick_replies(user_id);
CREATE INDEX idx_wa_scheduled_messages_pending ON wa_scheduled_messages(scheduled_at, status);

-- ============================================
-- Triggers para updated_at
-- ============================================
CREATE TRIGGER set_wa_sessions_updated_at
  BEFORE UPDATE ON wa_sessions
  FOR EACH ROW EXECUTE FUNCTION update_wa_updated_at();

CREATE TRIGGER set_wa_contacts_updated_at
  BEFORE UPDATE ON wa_contacts
  FOR EACH ROW EXECUTE FUNCTION update_wa_updated_at();

CREATE TRIGGER set_wa_chats_updated_at
  BEFORE UPDATE ON wa_chats
  FOR EACH ROW EXECUTE FUNCTION update_wa_updated_at();

CREATE TRIGGER set_wa_queues_updated_at
  BEFORE UPDATE ON wa_queues
  FOR EACH ROW EXECUTE FUNCTION update_wa_updated_at();

-- ============================================
-- Habilitar RLS (Row Level Security)
-- ============================================
ALTER TABLE wa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_queue_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_chat_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_scheduled_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Políticas RLS para wa_sessions
-- ============================================
CREATE POLICY "Users can view own sessions" ON wa_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions" ON wa_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON wa_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON wa_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Políticas RLS para wa_messages
-- ============================================
CREATE POLICY "Users can view messages in own sessions" ON wa_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wa_sessions 
      WHERE wa_sessions.id = wa_messages.session_id 
      AND wa_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert messages" ON wa_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update messages" ON wa_messages
  FOR UPDATE USING (true);

-- ============================================
-- Políticas RLS para wa_contacts
-- ============================================
CREATE POLICY "Users can view own contacts" ON wa_contacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own contacts" ON wa_contacts
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Políticas RLS para wa_chats
-- ============================================
CREATE POLICY "Users can view chats in own sessions" ON wa_chats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wa_sessions 
      WHERE wa_sessions.id = wa_chats.session_id 
      AND wa_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage chats" ON wa_chats
  FOR ALL USING (true);

-- ============================================
-- Políticas RLS para wa_queues
-- ============================================
CREATE POLICY "Users can view own queues" ON wa_queues
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own queues" ON wa_queues
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Políticas RLS para wa_queue_members
-- ============================================
CREATE POLICY "Users can view members of own queues" ON wa_queue_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wa_queues 
      WHERE wa_queues.id = wa_queue_members.queue_id 
      AND wa_queues.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage members of own queues" ON wa_queue_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM wa_queues 
      WHERE wa_queues.id = wa_queue_members.queue_id 
      AND wa_queues.user_id = auth.uid()
    )
  );

-- ============================================
-- Políticas RLS para wa_chat_events
-- ============================================
CREATE POLICY "Users can view events in own sessions" ON wa_chat_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wa_sessions 
      WHERE wa_sessions.id = wa_chat_events.session_id 
      AND wa_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert events" ON wa_chat_events
  FOR INSERT WITH CHECK (true);

-- ============================================
-- Políticas RLS para wa_ratings
-- ============================================
CREATE POLICY "Users can view ratings in own sessions" ON wa_ratings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wa_sessions 
      WHERE wa_sessions.id = wa_ratings.session_id 
      AND wa_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert ratings" ON wa_ratings
  FOR INSERT WITH CHECK (true);

-- ============================================
-- Políticas RLS para wa_quick_replies
-- ============================================
CREATE POLICY "Users can view own quick replies" ON wa_quick_replies
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own quick replies" ON wa_quick_replies
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Políticas RLS para wa_tags
-- ============================================
CREATE POLICY "Users can view own tags" ON wa_tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own tags" ON wa_tags
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Políticas RLS para wa_scheduled_messages
-- ============================================
CREATE POLICY "Users can view own scheduled messages" ON wa_scheduled_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own scheduled messages" ON wa_scheduled_messages
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Habilitar Realtime para tabelas importantes
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE wa_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE wa_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE wa_sessions;

-- ============================================
-- Conceder permissões para service_role
-- ============================================
GRANT ALL ON wa_sessions TO service_role;
GRANT ALL ON wa_messages TO service_role;
GRANT ALL ON wa_contacts TO service_role;
GRANT ALL ON wa_chats TO service_role;
GRANT ALL ON wa_queues TO service_role;
GRANT ALL ON wa_queue_members TO service_role;
GRANT ALL ON wa_chat_events TO service_role;
GRANT ALL ON wa_ratings TO service_role;
GRANT ALL ON wa_quick_replies TO service_role;
GRANT ALL ON wa_tags TO service_role;
GRANT ALL ON wa_scheduled_messages TO service_role;

-- Conceder permissões para authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_sessions TO authenticated;
GRANT SELECT ON wa_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_contacts TO authenticated;
GRANT SELECT ON wa_chats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_queues TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_queue_members TO authenticated;
GRANT SELECT ON wa_chat_events TO authenticated;
GRANT SELECT ON wa_ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_quick_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_scheduled_messages TO authenticated;

-- Conceder usage de sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================
-- Comentários nas tabelas (documentação)
-- ============================================
COMMENT ON TABLE wa_sessions IS 'Conexões WhatsApp (multi-número)';
COMMENT ON TABLE wa_messages IS 'Mensagens do chat';
COMMENT ON TABLE wa_contacts IS 'Contatos sincronizados do WhatsApp';
COMMENT ON TABLE wa_chats IS 'Metadados das conversas';
COMMENT ON TABLE wa_queues IS 'Filas de atendimento';
COMMENT ON TABLE wa_queue_members IS 'Membros das filas (agentes)';
COMMENT ON TABLE wa_chat_events IS 'Eventos do ciclo de vida';
COMMENT ON TABLE wa_ratings IS 'Pesquisas de satisfação (CSAT)';
COMMENT ON TABLE wa_quick_replies IS 'Respostas rápidas (/atalhos)';
COMMENT ON TABLE wa_tags IS 'Tags para contatos';
COMMENT ON TABLE wa_scheduled_messages IS 'Mensagens agendadas';
