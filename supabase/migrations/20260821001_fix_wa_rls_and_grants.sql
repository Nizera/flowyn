-- Fix RLS policies and grants for wa_messages and wa_chats
-- Problem: authenticated role only had SELECT, no INSERT/UPDATE/DELETE
-- Problem: service_role INSERT policy on wa_messages had no user ownership check

-- ============================================
-- wa_messages: allow authenticated users to manage messages in their own sessions
-- ============================================
DROP POLICY IF EXISTS "Service role can insert messages" ON wa_messages;
DROP POLICY IF EXISTS "Service role can update messages" ON wa_messages;

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

-- ============================================
-- wa_chats: allow authenticated users to manage chats in their own sessions
-- ============================================
DROP POLICY IF EXISTS "Service role can manage chats" ON wa_chats;

CREATE POLICY "Users can manage chats in own sessions" ON wa_chats
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM wa_sessions
      WHERE wa_sessions.id = wa_chats.session_id
      AND wa_sessions.user_id = auth.uid()
    )
  );

-- ============================================
-- Fix GRANTs: authenticated needs INSERT/UPDATE on messages and chats
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_chats TO authenticated;
