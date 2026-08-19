#!/bin/bash
set -e

REPO_URL="https://github.com/SEU-REPO/aflado.git"
DEPLOY_DIR="/opt/wa-worker"
BRANCH="main"

echo "=== Flowyn WhatsApp Worker - Deploy ==="

# Instalar Docker se não existir
if ! command -v docker &> /dev/null; then
    echo "Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "Docker instalado. Faça logout e login novamente, ou rode: newgrp docker"
fi

# Instalar Docker Compose se não existir
if ! command -v docker compose &> /dev/null; then
    echo "Instalando Docker Compose..."
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
fi

# Criar diretório de deploy
sudo mkdir -p $DEPLOY_DIR
sudo chown $USER:$USER $DEPLOY_DIR
cd $DEPLOY_DIR

# Clonar ou atualizar
if [ ! -d ".git" ]; then
    echo "Clonando repositório (sparse checkout)..."
    git clone --depth 1 --filter=blob:none --sparse --branch $BRANCH $REPO_URL .
    git sparse-checkout set services/wa-worker supabase/migrations
else
    echo "Atualizando código..."
    git pull
    git sparse-checkout set services/wa-worker supabase/migrations
fi

cd services/wa-worker

# Criar .env se não existir
if [ ! -f ".env" ]; then
    echo "Criando .env a partir do exemplo..."
    cp .env.example .env
    echo ""
    echo "!!! EDITE O .env COM SUAS CREDENCIAIS !!!"
    echo "    nano $DEPLOY_DIR/services/wa-worker/.env"
    echo ""
    exit 1
fi

# Criar volume para auth se não existir
docker volume create wa-auth 2>/dev/null || true

# Build e subir
echo "Building e iniciando container..."
docker compose up -d --build

# Verificar status
sleep 3
if docker compose ps | grep -q "running"; then
    echo ""
    echo "=== Worker rodando com sucesso! ==="
    echo "Logs: docker compose logs -f"
    echo "Status: docker compose ps"
    echo "Health: curl http://localhost:3001/health"
else
    echo ""
    echo "=== ERRO ao iniciar worker ==="
    docker compose logs
fi
