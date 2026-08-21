-- ============================================
-- Migration: Drop and recreate wa_sessions/wa_messages with correct schema
-- Problem: 20260811001 created tables with wrong schema (id UUID, missing columns)
--          20260820001 used IF NOT EXISTS so it skipped recreation
-- Result: Worker writes fail silently (columns like session_id, chat_jid, body don't exist)
-- ============================================

-- 1. Drop dependent tables (FK references wa_sessions)
DROP TABLE IF EXISTS wa_scheduled_messages CASCADE;
DROP TABLE IF EXISTS wa_ratings CASCADE;
DROP TABLE IF EXISTS wa_chat_events CASCADE;
DROP TABLE IF EXISTS wa_chats CASCADE;
DROP TABLE IF EXISTS wa_messages CASCADE;
DROP TABLE IF EXISTS wa_sessions CASCADE;

-- 2. Recreate wa_sessions with correct schema (id TEXT)
CREATE TABLE wa_sessions (
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

-- 3. Recreate wa_messages with correct schema (composite PK session_id + id TEXT)
CREATE TABLE wa_messages (
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

-- 4. Recreate wa_chats
CREATE TABLE wa_chats (
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

-- 5. Recreate wa_chat_events
CREATE TABLE wa_chat_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
  chat_jid TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('created', 'opened', 'closed', 'reassigned', 'transferred', 'note')),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  detail TEXT,
  ts BIGINT NOT NULL
);

-- 6. Recreate wa_ratings
CREATE TABLE wa_ratings (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
  chat_jid TEXT NOT NULL,
  score INT NOT NULL CHECK (score IN (1, 2, 3)),
  reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Recreate wa_scheduled_messages
CREATE TABLE wa_scheduled_messages (
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

-- 8. Indexes
CREATE INDEX idx_wa_messages_chat ON wa_messages(session_id, chat_jid, timestamp DESC);
CREATE INDEX idx_wa_messages_status ON wa_messages(session_id, status);
CREATE INDEX idx_wa_messages_from_me ON wa_messages(session_id, is_from_me);
CREATE INDEX idx_wa_chats_status ON wa_chats(session_id, status);
CREATE INDEX idx_wa_chats_assigned ON wa_chats(assigned_user_id, status);
CREATE INDEX idx_wa_chats_queue ON wa_chats(queue_id, status);
CREATE INDEX idx_wa_chat_events_chat ON wa_chat_events(session_id, chat_jid, ts);
CREATE INDEX idx_wa_chat_events_kind ON wa_chat_events(session_id, kind);
CREATE INDEX idx_wa_ratings_session ON wa_ratings(session_id, created_at DESC);
CREATE INDEX idx_wa_scheduled_messages_pending ON wa_scheduled_messages(scheduled_at, status);

-- 9. Triggers for updated_at
CREATE TRIGGER set_wa_sessions_updated_at
  BEFORE UPDATE ON wa_sessions
  FOR EACH ROW EXECUTE FUNCTION update_wa_updated_at();

CREATE TRIGGER set_wa_chats_updated_at
  BEFORE UPDATE ON wa_chats
  FOR EACH ROW EXECUTE FUNCTION update_wa_updated_at();

-- 10. Enable RLS
ALTER TABLE wa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_chat_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_scheduled_messages ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies - wa_sessions
CREATE POLICY "Users can view own sessions" ON wa_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sessions" ON wa_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON wa_sessions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON wa_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- 12. RLS Policies - wa_messages (authenticated: own sessions only; service_role: all)
CREATE POLICY "Users can view messages in own sessions" ON wa_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wa_sessions
      WHERE wa_sessions.id = wa_messages.session_id
      AND wa_sessions.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert messages in own sessions" ON wa_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM wa_sessions
      WHERE wa_sessions.id = wa_messages.session_id
      AND wa_sessions.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update messages in own sessions" ON wa_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM wa_sessions
      WHERE wa_sessions.id = wa_messages.session_id
      AND wa_sessions.user_id = auth.uid()
    )
  );

-- 13. RLS Policies - wa_chats
CREATE POLICY "Users can view chats in own sessions" ON wa_chats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wa_sessions
      WHERE wa_sessions.id = wa_chats.session_id
      AND wa_sessions.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can manage chats in own sessions" ON wa_chats
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM wa_sessions
      WHERE wa_sessions.id = wa_chats.session_id
      AND wa_sessions.user_id = auth.uid()
    )
  );

-- 14. RLS Policies - wa_chat_events
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

-- 15. RLS Policies - wa_ratings
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

-- 16. RLS Policies - wa_scheduled_messages
CREATE POLICY "Users can view own scheduled messages" ON wa_scheduled_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own scheduled messages" ON wa_scheduled_messages
  FOR ALL USING (auth.uid() = user_id);

-- 17. GRANTs
GRANT ALL ON wa_sessions TO service_role;
GRANT ALL ON wa_messages TO service_role;
GRANT ALL ON wa_chats TO service_role;
GRANT ALL ON wa_chat_events TO service_role;
GRANT ALL ON wa_ratings TO service_role;
GRANT ALL ON wa_scheduled_messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON wa_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_chats TO authenticated;
GRANT SELECT ON wa_chat_events TO authenticated;
GRANT SELECT ON wa_ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_scheduled_messages TO authenticated;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 18. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE wa_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE wa_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE wa_sessions;
