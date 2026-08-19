-- ============================================
-- Migration: Adicionar tabela de pagamentos PIX via WhatsApp
-- Data: 20/08/2026
-- ============================================

CREATE TABLE IF NOT EXISTS wa_pix_payments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
  chat_jid TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  external_reference TEXT,
  product_id UUID,
  plan_id UUID,
  asaas_payment_id TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE wa_pix_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own pix payments" ON wa_pix_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own pix payments" ON wa_pix_payments
  FOR ALL USING (auth.uid() = user_id);

-- Service role pode acessar tudo (para webhooks)
GRANT ALL ON wa_pix_payments TO service_role;
GRANT SELECT, INSERT, UPDATE ON wa_pix_payments TO authenticated;

-- Triggers
CREATE TRIGGER set_wa_pix_payments_updated_at
  BEFORE UPDATE ON wa_pix_payments
  FOR EACH ROW EXECUTE FUNCTION update_wa_updated_at();

-- Índices
CREATE INDEX idx_wa_pix_payments_session ON wa_pix_payments(session_id);
CREATE INDEX idx_wa_pix_payments_external ON wa_pix_payments(external_reference);
CREATE INDEX idx_wa_pix_payments_status ON wa_pix_payments(status);

-- Comentário
COMMENT ON TABLE wa_pix_payments IS 'Pagamentos PIX gerados via WhatsApp CRM';
