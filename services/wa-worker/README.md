# Flowyn WA Worker

Servico de WhatsApp multi-sessao para a Flowyn, baseado em Baileys.

## Pre-requisitos

- Node.js 20+
- Docker + Docker Compose
- Supabase ( PostgreSQL )
- Redis ( incluido no docker-compose )
- Uma VPS ARM64 (Oracle Cloud free tier funciona)

## Estrutura

```
services/wa-worker/
├── src/
│   ├── index.ts              -- Servidor principal
│   ├── config.ts             -- Variaveis de ambiente
│   ├── baileys/
│   │   └── session-manager.ts -- Gerencia sessoes WhatsApp
│   ├── server/routes/
│   │   ├── sessions.ts       -- CRUD de sessoes
│   │   └── messages.ts       -- Envio de mensagens
│   ├── webhook/
│   │   └── flowyn-webhook.ts -- Chama a Vercel
│   ├── queue/
│   │   └── rate-limiter.ts   -- Rate limit por destino
│   └── lib/
│       ├── database.ts       -- Prisma client
│       └── logger.ts         -- Pino logger
├── prisma/
│   └── schema.prisma         -- Schema do banco
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Setup Local

```bash
cd services/wa-worker

# Instalar dependencias
npm install

# Gerar Prisma Client
npx prisma generate

# Copiar .env
cp .env.example .env
# Editar .env com suas credenciais

# Rodar dev
npm run dev
```

## Deploy na VPS (Oracle Cloud ARM64)

### 1. Preparar a VPS

```bash
# Conectar na VPS
ssh ubuntu@seu-ip

# Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo apt install docker-compose-plugin -y

# Criar diretorio
mkdir -p /opt/flowyn-wa-worker
cd /opt/flowyn-wa-worker
```

### 2. Copiar os arquivos

```bash
# Da sua maquina local
scp -r services/wa-worker/* ubuntu@seu-ip:/opt/flowyn-wa-worker/
```

### 3. Configurar .env

```bash
# Na VPS
cd /opt/flowyn-wa-worker
nano .env
```

Variaveis obrigatorias:

```env
DATABASE_URL=postgresql://postgres:senha@db.xxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
FLOWYN_URL=https://aflado.vercel.app
FLOWYN_WEBHOOK_SECRET=gerar-segredo-aqui
WORKER_SECRET=gerar-outro-segredo-aqui
```

### 4. Build e rodar

```bash
# Build e iniciar
docker compose up -d --build

# Verificar logs
docker compose logs -f wa-worker

# Verificar status
curl http://localhost:3001/health
```

### 5. Configurar Nginx ( HTTPS )

```bash
# Instalar Nginx
sudo apt install nginx certbot python3-certbot-nginx -y

# Criar config
sudo nano /etc/nginx/sites-available/wa-worker
```

```nginx
server {
    listen 80;
    server_name wa-worker.seudominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Ativar
sudo ln -s /etc/nginx/sites-available/wa-worker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# HTTPS
sudo certbot --nginx -d wa-worker.seudominio.com
```

### 6. Configurar no Supabase

Rodar a migration no Supabase Dashboard > SQL Editor:

Copiar o conteudo de `supabase/migrations/20260811001_add_whatsapp_crm_tables.sql` e rodar.

### 7. Configurar na Vercel

Adicionar variaveis de ambiente:

```
WA_WORKER_URL=https://wa-worker.seudominio.com
WA_WORKER_SECRET=mesmo-segredo-do-worker
```

## API Endpoints

### Sessions

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/health` | Health check |
| POST | `/sessions` | Criar sessao (conectar WhatsApp) |
| GET | `/sessions/:userId/status` | Status da sessao |
| GET | `/sessions/:userId/qr` | Obter QR code |
| DELETE | `/sessions/:userId` | Desconectar |

### Messages

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/send-message` | Enviar mensagem |
| POST | `/send-bulk` | Enviar em massa |

### Exemplo: Criar sessao

```bash
curl -X POST http://localhost:3001/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu-secret" \
  -d '{"userId": "uuid-do-produtor"}'
```

### Exemplo: Enviar mensagem

```bash
curl -X POST http://localhost:3001/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu-secret" \
  -d '{
    "userId": "uuid-do-produtor",
    "phone": "5511999999999",
    "content": "Ola! Sua compra foi confirmada.",
    "type": "text"
  }'
```

## Limites

| Configuracao | Default | Descricao |
|-------------|---------|-----------|
| MAX_SESSIONS_PER_WORKER | 25 | Max de sessoes por processo |
| SESSION_RESTART_HOURS | 4 | Restart forcado a cada X horas |
| MESSAGE_DELAY_MIN_MS | 2000 | Delay minimo entre mensagens |
| MESSAGE_DELAY_MAX_MS | 5000 | Delay maximo entre mensagens |

## Escalabilidade

Para mais de 25 sessoes, subir mais workers:

```yaml
# docker-compose.yml
services:
  wa-worker-1:
    build: .
    ports: ["3001:3001"]
    # ...

  wa-worker-2:
    build: .
    ports: ["3002:3001"]
    # ...
```

O Redis distribui as filas entre os workers automaticamente.

## Monitoramento

```bash
# Logs
docker compose logs -f wa-worker

# Status das sessoes
curl -H "Authorization: Bearer secret" http://localhost:3001/health

# Redis
docker compose exec redis redis-cli INFO memory
```
