#!/bin/bash
cd /workspaces/pmo_pro_app

# Definir variáveis de ambiente
export MOCK_DEV=1
export SUPABASE_URL="http://localhost:dummy"
export SUPABASE_SERVICE_KEY="dummy-service-key"
export SUPABASE_ANON_KEY="dummy-anon-key"
export PORT=3000

echo "🔧 Iniciando servidor em modo MOCK_DEV..."
echo "📊 SUPABASE_URL: $SUPABASE_URL"
echo "🔑 MOCK_DEV: $MOCK_DEV"

# Verificar dependências
if [ ! -d "node_modules" ]; then
  echo "📦 Instalando dependências..."
  npm install
fi

# Verificar sintaxe
echo "🔍 Verificando sintaxe..."
node --check server.js || {
  echo "❌ Erro de sintaxe detectado!"
  exit 1
}

# Iniciar servidor
echo "🚀 Iniciando servidor..."
node server.js
