-- Sistema de Webhooks para Apps Externos
-- Permite que produtores configurem URLs de webhook para receberem
-- notificações quando assinaturas são criadas, renovadas ou canceladas

-- Enum para eventos de webhook suportados
CREATE TYPE webhook_event_type AS ENUM (
  'subscription.created',
  'subscription.renewed',
  'subscription.canceled',
  'subscription.payment_failed',
  'subscription.trial_ending',
  'payment.confirmed',
  'payment.failed',
  'payment.refunded'
);

-- Tabela de webhooks configurados por produtor
CREATE TABLE IF NOT EXISTS public.producer_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events webhook_event_type[] NOT NULL DEFAULT ARRAY['subscription.created', 'subscription.canceled']::webhook_event_type[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  last_triggered_at TIMESTAMPTZ,
  last_response_status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de tentativas de envio de webhook
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.producer_webhooks(id) ON DELETE CASCADE,
  event webhook_event_type NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Tabela de API keys para apps externos verificarem status de assinatura
CREATE TABLE IF NOT EXISTS public.producer_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default',
  permissions TEXT[] NOT NULL DEFAULT ARRAY['subscription:read']::text[],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_producer_webhooks_producer_id ON public.producer_webhooks(producer_id);
CREATE INDEX idx_producer_webhooks_is_active ON public.producer_webhooks(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_webhook_deliveries_webhook_id ON public.webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_event ON public.webhook_deliveries(event);
CREATE INDEX idx_webhook_deliveries_success ON public.webhook_deliveries(success);
CREATE INDEX idx_webhook_deliveries_next_retry ON public.webhook_deliveries(next_retry_at)
  WHERE next_retry_at IS NOT NULL AND success = FALSE;

CREATE INDEX idx_producer_api_keys_producer_id ON public.producer_api_keys(producer_id);
CREATE INDEX idx_producer_api_keys_key_hash ON public.producer_api_keys(key_hash);

-- RLS (Row Level Security)
ALTER TABLE public.producer_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producer_api_keys ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso

-- producer_webhooks: produtor só vê/edita os seus
CREATE POLICY "producer_webhooks_select_own" ON public.producer_webhooks
  FOR SELECT USING (auth.uid() = producer_id);

CREATE POLICY "producer_webhooks_insert_own" ON public.producer_webhooks
  FOR INSERT WITH CHECK (auth.uid() = producer_id);

CREATE POLICY "producer_webhooks_update_own" ON public.producer_webhooks
  FOR UPDATE USING (auth.uid() = producer_id);

CREATE POLICY "producer_webhooks_delete_own" ON public.producer_webhooks
  FOR DELETE USING (auth.uid() = producer_id);

-- webhook_deliveries: produtor só vê os seus (via join com producer_webhooks)
CREATE POLICY "webhook_deliveries_select_own" ON public.webhook_deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.producer_webhooks
      WHERE producer_webhooks.id = webhook_deliveries.webhook_id
      AND producer_webhooks.producer_id = auth.uid()
    )
  );

-- webhook_deliveries: service_role pode inserir/atualizar (para o sistema de envio)
CREATE POLICY "webhook_deliveries_service_role_insert" ON public.webhook_deliveries
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "webhook_deliveries_service_role_update" ON public.webhook_deliveries
  FOR UPDATE USING (auth.role() = 'service_role');

-- producer_api_keys: produtor só vê as suas
CREATE POLICY "producer_api_keys_select_own" ON public.producer_api_keys
  FOR SELECT USING (auth.uid() = producer_id);

CREATE POLICY "producer_api_keys_insert_own" ON public.producer_api_keys
  FOR INSERT WITH CHECK (auth.uid() = producer_id);

CREATE POLICY "producer_api_keys_delete_own" ON public.producer_api_keys
  FOR DELETE USING (auth.uid() = producer_id);

-- Função para limpar entregas antigas (manter apenas últimos 30 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_deliveries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.webhook_deliveries
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_producer_webhooks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_producer_webhooks_updated_at
  BEFORE UPDATE ON public.producer_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_producer_webhooks_updated_at();
