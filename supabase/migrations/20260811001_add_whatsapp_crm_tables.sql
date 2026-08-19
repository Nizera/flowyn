-- ============================================
-- WhatsApp CRM Tables for Flowyn
-- ============================================

-- Sessoes WhatsApp (1 por produtor)
CREATE TABLE IF NOT EXISTS wa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone_number TEXT,
  instance_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected','connecting','qr_pending','connected','error','banned')),
  qr_code TEXT,
  pairing_code TEXT,
  config JSONB DEFAULT '{}',
  worker_id TEXT,
  lease_expires_at TIMESTAMPTZ,
  last_connected_at TIMESTAMPTZ,
  reconnect_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Contatos WhatsApp
CREATE TABLE IF NOT EXISTS wa_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  push_name TEXT,
  is_business BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual','sync','checkout','campaign','import','webhook')),
  notes TEXT,
  last_message_at TIMESTAMPTZ,
  total_orders INT DEFAULT 0,
  total_revenue NUMERIC(10,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, phone)
);

-- Conversas WhatsApp
CREATE TABLE IF NOT EXISTS wa_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES wa_contacts(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  campaign_id UUID,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','pending','closed','archived')),
  assigned_to TEXT DEFAULT 'bot',
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_conversations_user_status ON wa_conversations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_contact ON wa_conversations(contact_id);

-- Mensagens WhatsApp
CREATE TABLE IF NOT EXISTS wa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES wa_conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES wa_contacts(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  type TEXT NOT NULL DEFAULT 'text'
    CHECK (type IN ('text','image','video','audio','document','location','sticker','reaction','system')),
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  status TEXT CHECK (status IN ('pending','sent','delivered','read','failed')),
  provider_message_id TEXT UNIQUE,
  error_message TEXT,
  quoted_message_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation ON wa_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_messages_provider_id ON wa_messages(provider_message_id);

-- Campanhas WhatsApp
CREATE TABLE IF NOT EXISTS wa_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sending','paused','completed','failed')),
  keyword TEXT NOT NULL,
  pre_filled_message TEXT NOT NULL,
  auto_reply_enabled BOOLEAN DEFAULT true,
  auto_reply_message TEXT,
  meta_campaign_id TEXT,
  meta_adset_id TEXT,
  meta_ad_id TEXT,
  whatsapp_number TEXT,
  product_id UUID,
  target_tags TEXT[] DEFAULT '{}',
  total_clicks INT DEFAULT 0,
  total_messages INT DEFAULT 0,
  total_replies INT DEFAULT 0,
  total_conversions INT DEFAULT 0,
  total_revenue NUMERIC(10,2) DEFAULT 0,
  total_spend NUMERIC(10,2) DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, keyword)
);

-- Destinatarios de campanhas
CREATE TABLE IF NOT EXISTS wa_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES wa_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES wa_contacts(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','read','replied','failed')),
  is_reply BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  error_message TEXT,
  order_id UUID,
  revenue NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients ON wa_campaign_recipients(campaign_id, status);

-- Atribuicao de pedidos a campanhas
CREATE TABLE IF NOT EXISTS wa_order_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL UNIQUE,
  contact_id UUID REFERENCES wa_contacts(id),
  campaign_id UUID REFERENCES wa_campaigns(id),
  conversation_id UUID,
  attribution_type TEXT NOT NULL DEFAULT 'phone_match'
    CHECK (attribution_type IN ('phone_match','ref_param','keyword','manual')),
  confidence NUMERIC(3,2) DEFAULT 0.8,
  first_contact_at TIMESTAMPTZ,
  order_created_at TIMESTAMPTZ,
  hours_between NUMERIC(6,1),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Automacoes WhatsApp
CREATE TABLE IF NOT EXISTS wa_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('first_message','keyword_match','tag_added','no_reply_24h','no_reply_72h','order_created','schedule')),
  trigger_config JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  total_triggered INT DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cliques em anuncios
CREATE TABLE IF NOT EXISTS wa_ad_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES wa_campaigns(id),
  meta_campaign_id TEXT,
  meta_adset_id TEXT,
  meta_ad_id TEXT,
  fbclid TEXT,
  phone TEXT,
  ip_address TEXT,
  clicked_at TIMESTAMPTZ DEFAULT now(),
  matched_order_id UUID,
  matched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_ad_clicks_phone ON wa_ad_clicks(phone, clicked_at);
CREATE INDEX IF NOT EXISTS idx_wa_ad_clicks_user ON wa_ad_clicks(user_id, clicked_at);

-- Analytics diario
CREATE TABLE IF NOT EXISTS wa_analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  campaign_id UUID,
  messages_sent INT DEFAULT 0,
  messages_received INT DEFAULT 0,
  messages_delivered INT DEFAULT 0,
  messages_read INT DEFAULT 0,
  messages_failed INT DEFAULT 0,
  conversations_started INT DEFAULT 0,
  conversations_closed INT DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  orders_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date, campaign_id)
);

-- RLS Policies
ALTER TABLE wa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_order_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_ad_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_analytics_daily ENABLE ROW LEVEL SECURITY;

-- Service role bypass
REVOKE ALL ON wa_sessions FROM authenticated;
REVOKE ALL ON wa_contacts FROM authenticated;
REVOKE ALL ON wa_conversations FROM authenticated;
REVOKE ALL ON wa_messages FROM authenticated;
REVOKE ALL ON wa_campaigns FROM authenticated;
REVOKE ALL ON wa_campaign_recipients FROM authenticated;
REVOKE ALL ON wa_order_attribution FROM authenticated;
REVOKE ALL ON wa_automations FROM authenticated;
REVOKE ALL ON wa_ad_clicks FROM authenticated;
REVOKE ALL ON wa_analytics_daily FROM authenticated;

GRANT ALL ON wa_sessions TO service_role;
GRANT ALL ON wa_contacts TO service_role;
GRANT ALL ON wa_conversations TO service_role;
GRANT ALL ON wa_messages TO service_role;
GRANT ALL ON wa_campaigns TO service_role;
GRANT ALL ON wa_campaign_recipients TO service_role;
GRANT ALL ON wa_order_attribution TO service_role;
GRANT ALL ON wa_automations TO service_role;
GRANT ALL ON wa_ad_clicks TO service_role;
GRANT ALL ON wa_analytics_daily TO service_role;
