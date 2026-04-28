#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if ! command -v psql >/dev/null 2>&1; then
  echo "❌ psql no está instalado"
  exit 1
fi

echo "🚀 Aplicando migraciones del repo sobre $DB_URL"

found=0
while IFS= read -r file; do
  found=1
  echo "==> $file"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$file"
done < <(find supabase/migrations -maxdepth 1 -type f -name '[0-9]*.sql' | sort)

if [[ "$found" -eq 0 ]]; then
  echo "⚠️ No se encontraron migraciones del repo"
fi

echo "✅ Migraciones del repo aplicadas"
