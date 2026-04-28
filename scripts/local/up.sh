#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

DUMP_FILE="${1:-}"

touch supabase/seed.sql

echo "🚀 Levantando Supabase local..."
supabase start --exclude vector --ignore-health-check

echo "🧾 Generando env locales..."
node scripts/local/write-local-env.mjs

if [[ -n "$DUMP_FILE" ]]; then
  echo "📦 Importando dump local: $DUMP_FILE"
  bash scripts/local/import-db-dump.sh "$DUMP_FILE"
  echo "🧱 Aplicando migraciones del repo sobre el dump importado..."
  bash scripts/local/apply-repo-migrations.sh
else
  cat <<'EOF'
⚠️ No se proporcionó dump de producción.
El stack local queda arriba, pero la base solo tiene el esquema base de Supabase.
Para un clon fiel de negocio:
  1. Consigue un dump SQL/SQL.GZ del proyecto productivo
  2. Ejecuta: bash scripts/local/up.sh /ruta/al/dump.sql.gz
EOF
fi

echo "🐳 Levantando apps en Docker..."
docker compose -f docker-compose.local.yml up --build -d api landing backoffice

cat <<'EOF'
✅ Stack local iniciado

URLs:
  - Landing:    http://localhost:3001
  - Backoffice: http://localhost:3000
  - API legacy: http://localhost:4000
  - Supabase:   http://localhost:54321
  - Studio:     http://localhost:54323
  - Inbucket:   http://localhost:54324
EOF
