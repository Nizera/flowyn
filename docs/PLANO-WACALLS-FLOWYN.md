# Plano de Integração: WaCalls + Flowyn

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FLOWYN (Vercel)                                │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        Frontend (Next.js)                             │  │
│  │                                                                       │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐  │  │
│  │  │ Chat/WhatsApp │ │   Contatos   │ │    Filas     │ │ Relatórios │  │  │
│  │  │              │ │              │ │              │ │            │  │  │
│  │  │ • Lista de   │ │ • Busca      │ │ • Round-robin│ │ • SLA      │  │  │
│  │  │   conversas  │ │ • Edição     │ │ • Agentes    │ │ • Performance│ │  │
│  │  │ • Mensagens  │ │ • Avatar     │ │ • Horários   │ │ • CSAT     │  │  │
│  │  │ • Envio      │ │ • Tags       │ │ • Greetings  │ │ • Gráficos │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                         │                                   │
│                                         ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     API Routes (Next.js)                              │  │
│  │                                                                       │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │  │
│  │  │ /api/wa/*        │  │ /api/webhooks/* │  │ /api/reports/*  │      │  │
│  │  │ (Proxy para     │  │ (Receber eventos│  │ (Métricas e     │      │  │
│  │  │  WA Worker)     │  │  do WA Worker)  │  │  relatórios)    │      │  │
│  │  └────────┬────────┘  └────────┬────────┘  └─────────────────┘      │  │
│  └───────────┼────────────────────┼──────────────────────────────────────┘  │
│              │                    │                                         │
└──────────────┼────────────────────┼─────────────────────────────────────────┘
               │                    │
               ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WA WORKER (Servidor Dedicado - VPS)                      │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       Go Server (porta 3001)                          │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │  │
│  │  │  whatsmeow   │  │  Session    │  │  Message    │  │  Contact   │  │  │
│  │  │  (WhatsApp)  │  │  Manager    │  │  Queue      │  │  Sync      │  │  │
│  │  └──────┬──────┘  └─────────────┘  └─────────────┘  └────────────┘  │  │
│  │         │                                                            │  │
│  │         ▼                                                            │  │
│  │  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │  │              WhatsApp Multi-Device Protocol                  │    │  │
│  │  │  • Pareamento QR Code                                        │    │  │
│  │  │  • Envio/Recebimento de mensagens                           │    │  │
│  │  │  • Sincronização de contatos                                │    │  │
│  │  │  • Status de entrega (✓, ✓✓, azul)                          │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                         │                                   │
│                                         ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    WhatsApp Servers (Meta)                            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Supabase (Banco de Dados)                         │
│                                                                             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐              │
│  │  wa_sessions    │ │  wa_messages    │ │  wa_contacts    │              │
│  │  (Conexões WA)  │ │  (Mensagens)    │ │  (Contatos)     │              │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘              │
│                                                                             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐              │
│  │  wa_chats       │ │  wa_queues      │ │  wa_chat_events │              │
│  │  (Metadados)    │ │  (Filas)        │ │  (Eventos)      │              │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘              │
│                                                                             │
│  ┌─────────────────┐ ┌─────────────────┐                                   │
│  │  wa_agents      │ │  wa_ratings     │                                   │
│  │  (Agentes)      │ │  (CSAT)         │                                   │
│  └─────────────────┘ └─────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## SEÇÃO 1: O Que Roda na VPS (WA Worker)

### 1.1 Responsabilidades do WA Worker

| Responsabilidade | Descrição |
|------------------|-----------|
| **Conexão WhatsApp** | Gerenciar pareamento QR Code e manter sessões ativas |
| **Envio de Mensagens** | Enviar textos, mídias, documentos |
| **Recebimento de Mensagens** | Receber e processar mensagens entrantes |
| **Sincronização de Contatos** | Buscar nomes e fotos de perfil |
| **Status de Entrega** | Rastrear ✓, ✓✓, mensagens lidas |
| **Gerenciamento de Sessões** | Criar, listar, deletar conexões |
| **Fila de Envio** | Rate limiting e retry automático |

### 1.2 Endpoints do WA Worker (Go)

```
POST   /api/sessions                    → Criar sessão WhatsApp
GET    /api/sessions                    → Listar sessões
DELETE /api/sessions/:id                → Deletar sessão
POST   /api/sessions/:id/pair           → Gerar QR Code
POST   /api/sessions/:id/logout         → Desconectar

POST   /api/messages/send               → Enviar mensagem
POST   /api/messages/bulk               → Enviar em massa
GET    /api/messages/:sessionId/:chatJid → Buscar mensagens

GET    /api/contacts/:sessionId         → Listar contatos
POST   /api/contacts/sync               → Sincronizar contatos

POST   /api/webhook                     → Receber eventos ( callback para Flowyn)

GET    /health                          → Health check
```

### 1.3 Configuração do WA Worker

```bash
# Variáveis de ambiente
PORT=3001
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
FLOWYN_API_URL=https://flowyn.com.br
FLOWYN_WEBHOOK_SECRET=secret_aqui
WA_WORKER_SECRET=token_aqui
LOG_LEVEL=info
```

### 1.4 Deploy do WA Worker

```bash
# Build
go build -o wa-worker ./cmd/server

# Executar
./wa-worker -addr :3001 -db /var/lib/wa-worker/data.db

# Systemd
systemctl enable --now wa-worker
```

---

## SEÇÃO 2: O Que Roda na Flowyn (Vercel)

### 2.1 Responsabilidades da Flowyn

| Responsabilidade | Descrição |
|------------------|-----------|
| **Frontend (UI)** | Interface do usuário (chat, contatos, filas) |
| **API Routes** | Proxy para WA Worker + lógica de negócio |
| **Autenticação** | Login/usuarios via Supabase Auth |
| **Banco de Dados** | Armazenar dados via Supabase |
| **Relatórios** | Métricas, SLA, CSAT |
| **Integrações** | Asaas, Meta Pixel, CAPI |

### 2.2 Estrutura de Pastas

```
src/app/(app)/dashboard/wa/
├── layout.tsx                    # Layout da seção WhatsApp
├── page.tsx                      # Dashboard principal
├── chats/
│   ├── page.tsx                  # Lista de conversas
│   └── [chatId]/
│       └── page.tsx              # Conversa individual
├── contacts/
│   └── page.tsx                  # Lista de contatos
├── queues/
│   └── page.tsx                  # Gerenciar filas
├── connections/
│   └── page.tsx                  # Conexões WhatsApp (QR Code)
└── reports/
    └── page.tsx                  # Relatórios

src/app/api/wa/
├── sessions/
│   ├── route.ts                  # GET (listar) / POST (criar)
│   └── [id]/
│       ├── route.ts              # DELETE (deletar)
│       ├── pair/
│       │   └── route.ts          # POST (QR Code)
│       └── logout/
│           └── route.ts          # POST (desconectar)
├── messages/
│   ├── route.ts                  # POST (enviar)
│   └── [sessionId]/
│       └── [chatJid]/
│           └── route.ts          # GET (listar)
├── contacts/
│   └── route.ts                  # GET (listar) / POST (criar)
├── queues/
│   └── route.ts                  # GET / POST / PUT / DELETE
└── webhook/
    └── route.ts                  # Receber eventos do WA Worker

src/lib/
├── wa-client.ts                  # Cliente para chamar WA Worker
├── wa-types.ts                   # Tipos TypeScript
└── wa-hooks.ts                   # Hooks React (useMessages, useChats, etc)

src/components/wa/
├── ChatList.tsx                  # Lista de conversas
├── ChatWindow.tsx                # Janela de mensagem
├── MessageBubble.tsx             # Balão de mensagem
├── MessageInput.tsx              # Campo de envio
├── ContactList.tsx               # Lista de contatos
├── QRCodeDisplay.tsx             # Exibir QR Code
├── QueueManager.tsx              # Gerenciar filas
└── AgentSelector.tsx             # Selecionar agente
```

### 2.3 API Routes (Next.js)

#### Proxy para WA Worker

```typescript
// src/lib/wa-client.ts
const WA_WORKER_URL = process.env.WA_WORKER_URL || 'http://localhost:3001'
const WA_WORKER_SECRET = process.env.WA_WORKER_SECRET

export const waClient = {
  sessions: {
    list: () => fetch(`${WA_WORKER_URL}/api/sessions`, {
      headers: { Authorization: `Bearer ${WA_WORKER_SECRET}` }
    }).then(r => r.json()),
    
    create: (name: string) => fetch(`${WA_WORKER_URL}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WA_WORKER_SECRET}` 
      },
      body: JSON.stringify({ name })
    }).then(r => r.json()),
    
    pair: (id: string) => fetch(`${WA_WORKER_URL}/api/sessions/${id}/pair`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_WORKER_SECRET}` }
    }).then(r => r.json()),
  },
  
  messages: {
    list: (sessionId: string, chatJid: string) => 
      fetch(`${WA_WORKER_URL}/api/messages/${sessionId}/${chatJid}`, {
        headers: { Authorization: `Bearer ${WA_WORKER_SECRET}` }
      }).then(r => r.json()),
    
    send: (sessionId: string, to: string, text: string) => 
      fetch(`${WA_WORKER_URL}/api/messages/send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WA_WORKER_SECRET}` 
        },
        body: JSON.stringify({ sessionId, to, text })
      }).then(r => r.json()),
  }
}
```

#### Webhook (Receber Eventos do WA Worker)

```typescript
// src/app/api/wa/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(req: NextRequest) {
  // Verificar autenticação
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.WA_WORKER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const event = await req.json()
  const supabase = createAdminClient()
  
  switch (event.type) {
    case 'message.received':
      // Salvar mensagem no Supabase
      await supabase.from('wa_messages').upsert({
        id: event.messageId,
        session_id: event.sessionId,
        chat_jid: event.chatJid,
        from_jid: event.from,
        body: event.body,
        timestamp: event.timestamp,
        is_from_me: false
      })
      break
      
    case 'message.sent':
      // Atualizar status da mensagem
      await supabase.from('wa_messages').update({
        status: 'sent'
      }).eq('id', event.messageId)
      break
      
    case 'session.status':
      // Atualizar status da sessão
      await supabase.from('wa_sessions').update({
        status: event.status
      }).eq('id', event.sessionId)
      break
      
    case 'contact.sync':
      // Sincronizar contato
      await supabase.from('wa_contacts').upsert({
        phone: event.phone,
        name: event.name,
        avatar_url: event.avatarUrl
      }, { onConflict: 'phone' })
      break
  }
  
  return NextResponse.json({ received: true })
}
```

### 2.4 Hooks React

```typescript
// src/lib/wa-hooks.ts
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

export function useChats(sessionId: string | null) {
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  
  useEffect(() => {
    if (!sessionId) return
    
    // Buscar chats
    const fetchChats = async () => {
      const { data } = await supabase
        .from('wa_chats')
        .select('*')
        .eq('session_id', sessionId)
        .order('last_message_at', { ascending: false })
      
      setChats(data || [])
      setLoading(false)
    }
    
    fetchChats()
    
    // Escutar mudanças em tempo real
    const channel = supabase
      .channel('wa-chats')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'wa_chats',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setChats(prev => [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setChats(prev => prev.map(chat => 
            chat.id === payload.new.id ? payload.new : chat
          ))
        }
      })
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])
  
  return { chats, loading }
}

export function useMessages(sessionId: string, chatJid: string | null) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  
  useEffect(() => {
    if (!chatJid) return
    
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('wa_messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('chat_jid', chatJid)
        .order('timestamp', { ascending: true })
        .limit(100)
      
      setMessages(data || [])
      setLoading(false)
    }
    
    fetchMessages()
    
    // Escutar novas mensagens
    const channel = supabase
      .channel('wa-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'wa_messages',
        filter: `session_id=eq.${sessionId}&chat_jid=eq.${chatJid}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, chatJid])
  
  const sendMessage = useCallback(async (text: string) => {
    const response = await fetch('/api/wa/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, to: chatJid, text })
    })
    
    return response.json()
  }, [sessionId, chatJid])
  
  return { messages, loading, sendMessage }
}
```

---

## SEÇÃO 3: Schema do Banco de Dados (Supabase)

### 3.1 Tabelas Principais

```sql
-- ============================================
-- TABELA: wa_sessions
-- Conexões WhatsApp (multi-número)
-- ============================================
CREATE TABLE wa_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected', -- disconnected, qr_pending, connected
  jid TEXT, -- WhatsApp JID
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
CREATE TABLE wa_messages (
  id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
  chat_jid TEXT NOT NULL,
  from_jid TEXT NOT NULL,
  to_jid TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'text', -- text, image, video, audio, document
  media_url TEXT,
  media_mime TEXT,
  file_name TEXT,
  file_size BIGINT,
  quoted_id TEXT,
  sender_name TEXT,
  is_from_me BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, delivered, read
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, id)
);

-- ============================================
-- TABELA: wa_contacts
-- Contatos sincronizados do WhatsApp
-- ============================================
CREATE TABLE wa_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
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
CREATE TABLE wa_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
  chat_jid TEXT NOT NULL,
  name TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, open, closed
  assigned_user_id UUID,
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
CREATE TABLE wa_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#25D366',
  distribution TEXT NOT NULL DEFAULT 'manual', -- manual, round-robin
  max_load INT NOT NULL DEFAULT 10,
  greeting_message TEXT,
  out_of_hours_message TEXT,
  business_hours JSONB, -- {mon: {open: "09:00", close: "18:00"}, ...}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABELA: wa_queue_members
-- Membros das filas (agentes)
-- ============================================
CREATE TABLE wa_queue_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES wa_queues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  max_load INT NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(queue_id, user_id)
);

-- ============================================
-- TABELA: wa_chat_events
-- Eventos do ciclo de vida
-- ============================================
CREATE TABLE wa_chat_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
  chat_jid TEXT NOT NULL,
  kind TEXT NOT NULL, -- created, opened, closed, reassigned, transferred
  user_id UUID,
  user_email TEXT,
  detail TEXT,
  ts BIGINT NOT NULL
);

-- ============================================
-- TABELA: wa_ratings
-- Pesquisas de satisfação (CSAT)
-- ============================================
CREATE TABLE wa_ratings (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
  chat_jid TEXT NOT NULL,
  score INT NOT NULL, -- 1=Bom, 2=Regular, 3=Ruim
  reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABELA: wa_quick_replies
-- Respostas rápidas (/atalhos)
-- ============================================
CREATE TABLE wa_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  shortcut TEXT NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, shortcut)
);
```

### 3.2 Índices

```sql
-- Performance
CREATE INDEX idx_wa_messages_chat ON wa_messages(session_id, chat_jid, timestamp DESC);
CREATE INDEX idx_wa_messages_status ON wa_messages(session_id, status);
CREATE INDEX idx_wa_chats_status ON wa_chats(session_id, status);
CREATE INDEX idx_wa_chats_assigned ON wa_chats(assigned_user_id, status);
CREATE INDEX idx_wa_contacts_phone ON wa_contacts(user_id, phone);
CREATE INDEX idx_wa_chat_events_chat ON wa_chat_events(session_id, chat_jid, ts);
```

### 3.3 RLS (Row Level Security)

```sql
-- Habilitar RLS
ALTER TABLE wa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_queue_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_chat_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_quick_replies ENABLE ROW LEVEL SECURITY;

-- Políticas para wa_sessions
CREATE POLICY "Users can view own sessions" ON wa_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions" ON wa_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON wa_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON wa_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para wa_messages (via session ownership)
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

-- Políticas para wa_contacts
CREATE POLICY "Users can view own contacts" ON wa_contacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own contacts" ON wa_contacts
  FOR ALL USING (auth.uid() = user_id);

-- Políticas para wa_chats
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

-- Políticas para wa_queues
CREATE POLICY "Users can view own queues" ON wa_queues
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own queues" ON wa_queues
  FOR ALL USING (auth.uid() = user_id);

-- Políticas para wa_queue_members
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
```

---

## SEÇÃO 4: Passo a Passo da Implementação

### Fase 1: Preparação (Semana 1)

| # | Tarefa | Arquivos | Status |
|---|--------|----------|--------|
| 1.1 | Criar migration Supabase | `supabase/migrations/20260820_add_wa_tables.sql` | ⬜ |
| 1.2 | Criar tipos TypeScript | `src/lib/wa-types.ts` | ⬜ |
| 1.3 | Criar cliente WA Worker | `src/lib/wa-client.ts` | ⬜ |
| 1.4 | Configurar variáveis de ambiente | `.env.local` | ⬜ |

### Fase 2: Backend - API Routes (Semana 2)

| # | Tarefa | Arquivos | Status |
|---|--------|----------|--------|
| 2.1 | API Sessions (CRUD) | `src/app/api/wa/sessions/route.ts` | ⬜ |
| 2.2 | API Sessions Pair | `src/app/api/wa/sessions/[id]/pair/route.ts` | ⬜ |
| 2.3 | API Messages | `src/app/api/wa/messages/route.ts` | ⬜ |
| 2.4 | API Messages List | `src/app/api/wa/messages/[sessionId]/[chatJid]/route.ts` | ⬜ |
| 2.5 | API Contacts | `src/app/api/wa/contacts/route.ts` | ⬜ |
| 2.6 | API Queues | `src/app/api/wa/queues/route.ts` | ⬜ |
| 2.7 | API Webhook | `src/app/api/wa/webhook/route.ts` | ⬜ |

### Fase 3: Frontend - Layout (Semana 3)

| # | Tarefa | Arquivos | Status |
|---|--------|----------|--------|
| 3.1 | Layout WhatsApp | `src/app/(app)/dashboard/wa/layout.tsx` | ⬜ |
| 3.2 | Dashboard Principal | `src/app/(app)/dashboard/wa/page.tsx` | ⬜ |
| 3.3 | Sidebar WhatsApp | Atualizar `src/components/Sidebar.tsx` | ⬜ |

### Fase 4: Frontend - Chat (Semana 4)

| # | Tarefa | Arquivos | Status |
|---|--------|----------|--------|
| 4.1 | Lista de Conversas | `src/components/wa/ChatList.tsx` | ⬜ |
| 4.2 | Janela de Chat | `src/components/wa/ChatWindow.tsx` | ⬜ |
| 4.3 | Balão de Mensagem | `src/components/wa/MessageBubble.tsx` | ⬜ |
| 4.4 | Campo de Envio | `src/components/wa/MessageInput.tsx` | ⬜ |
| 4.5 | Página de Conversas | `src/app/(app)/dashboard/wa/chats/page.tsx` | ⬜ |

### Fase 5: Frontend - Conexões (Semana 5)

| # | Tarefa | Arquivos | Status |
|---|--------|----------|--------|
| 5.1 | QR Code Display | `src/components/wa/QRCodeDisplay.tsx` | ⬜ |
| 5.2 | Página Conexões | `src/app/(app)/dashboard/wa/connections/page.tsx` | ⬜ |
| 5.3 | Status da Conexão | `src/components/wa/ConnectionStatus.tsx` | ⬜ |

### Fase 6: Frontend - Contatos (Semana 6)

| # | Tarefa | Arquivos | Status |
|---|--------|----------|--------|
| 6.1 | Lista de Contatos | `src/components/wa/ContactList.tsx` | ⬜ |
| 6.2 | Página Contatos | `src/app/(app)/dashboard/wa/contacts/page.tsx` | ⬜ |
| 6.3 | Formulário Contato | `src/components/wa/ContactForm.tsx` | ⬜ |

### Fase 7: Frontend - Filas (Semana 7)

| # | Tarefa | Arquivos | Status |
|---|--------|----------|--------|
| 7.1 | Gerenciador Filas | `src/components/wa/QueueManager.tsx` | ⬜ |
| 7.2 | Página Filas | `src/app/(app)/dashboard/wa/queues/page.tsx` | ⬜ |
| 7.3 | Seletor de Agente | `src/components/wa/AgentSelector.tsx` | ⬜ |

### Fase 8: Hooks React (Semana 8)

| # | Tarefa | Arquivos | Status |
|---|--------|----------|--------|
| 8.1 | Hook useChats | `src/lib/wa-hooks.ts` | ⬜ |
| 8.2 | Hook useMessages | `src/lib/wa-hooks.ts` | ⬜ |
| 8.3 | Hook useSession | `src/lib/wa-hooks.ts` | ⬜ |
| 8.4 | Hook useContacts | `src/lib/wa-hooks.ts` | ⬜ |

### Fase 9: Integrações (Semana 9)

| # | Tarefa | Arquivos | Status |
|---|--------|----------|--------|
| 9.1 | Asaas (pagamentos) | `src/lib/asaas.ts` | ⬜ |
| 9.2 | Meta Pixel | `src/lib/meta-pixel.ts` | ⬜ |
| 9.3 | Meta CAPI | `src/lib/meta-capi.ts` | ⬜ |
| 9.4 | Relatórios | `src/app/(app)/dashboard/wa/reports/page.tsx` | ⬜ |

### Fase 10: Testes e Deploy (Semana 10)

| # | Tarefa | Arquivos | Status |
|---|--------|----------|--------|
| 10.1 | Testes unitários | `__tests__/wa/` | ⬜ |
| 10.2 | Testes E2E | `e2e/wa.spec.ts` | ⬜ |
| 10.3 | Deploy WA Worker | VPS | ⬜ |
| 10.4 | Deploy Flowyn | Vercel | ⬜ |

---

## SEÇÃO 5: Variáveis de Ambiente

### Flowyn (Vercel)

```env
# WA Worker
WA_WORKER_URL=https://wa-worker.seudominio.com.br
WA_WORKER_SECRET=token_secreto_aqui

# Supabase (já existe)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Meta (já existe)
META_PIXEL_ID=...
META_ACCESS_TOKEN=...

# Asaas
ASAAS_API_KEY=...
ASAAS_ENVIRONMENT=production
```

### WA Worker (VPS)

```env
PORT=3001
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
FLOWYN_API_URL=https://flowyn.com.br
FLOWYN_WEBHOOK_SECRET=secret_aqui
WA_WORKER_SECRET=token_secreto_aqui
LOG_LEVEL=info
```

---

## SEÇÃO 6: Fluxos de Dados

### 6.1 Mensagem Recebida (Cliente → Flowyn)

```
1. Cliente envia mensagem via WhatsApp
2. WhatsApp envia para WA Worker (whatsmeow)
3. WA Worker salva localmente (backup)
4. WA Worker envia webhook para Flowyn
   POST https://flowyn.com.br/api/wa/webhook
   Body: { type: "message.received", message: {...} }
5. Flowyn salva no Supabase (wa_messages)
6. Supabase Realtime notifica o frontend
7. Frontend atualiza a UI em tempo real
```

### 6.2 Mensagem Enviada (Flowyn → Cliente)

```
1. Usuário digita mensagem no chat
2. Frontend chama API Route
   POST /api/wa/messages
   Body: { sessionId, to, text }
3. API Route chama WA Worker
   POST https://wa-worker.seudominio.com.br/api/messages/send
   Body: { sessionId, to, text }
4. WA Worker envia via whatsmeow
5. WhatsApp entrega para o cliente
6. WA Worker retorna status
7. Flowyn atualiza status no Supabase
```

### 6.3 Pareamento QR Code

```
1. Usuário clica "Nova Conexão"
2. Frontend chama API Route
   POST /api/wa/sessions
   Body: { name: "Minha Loja" }
3. API Route cria sessão no Supabase
4. API Route chama WA Worker
   POST https://wa-worker.seudominio.com.br/api/sessions
5. WA Worker cria sessão whatsmeow
6. Usuário clica "Parear"
7. Frontend chama API Route
   POST /api/wa/sessions/{id}/pair
8. API Route chama WA Worker
   POST https://wa-worker.seudominio.com.br/api/sessions/{id}/pair
9. WA Worker retorna QR Code
10. Frontend exibe QR Code
11. Usuário escaneia com celular
12. WA Worker conecta
13. Webhook notifica Flowyn
14. Status muda para "connected"
```

---

## SEÇÃO 7: Checklist de Segurança

- [ ] WA Worker Secret token único e seguro
- [ ] Webhook com verificação de assinatura
- [ ] RLS habilitado em todas as tabelas
- [ ] Rate limiting nas API Routes
- [ ] Validação de输入 em todas as rotas
- [ ] Logs de auditoria
- [ ] Backup automático do banco
- [ ] HTTPS obrigatório
- [ ] CORS configurado corretamente

---

## SEÇÃO 8: Métricas de Sucesso

| Métrica | Meta |
|---------|------|
| Tempo de primeira resposta | < 5 minutos |
| Taxa de entrega | > 95% |
| Uptime do WA Worker | > 99.9% |
| Latência do chat | < 500ms |
| Satisfação do cliente (CSAT) | > 4.5/5 |

---

*Documento criado em 20/08/2026*
*Versão: 1.0*
