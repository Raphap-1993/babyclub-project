#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

DUMP_FILE="${1:-}"
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if [[ -z "$DUMP_FILE" ]]; then
  echo "Uso: scripts/local/import-db-dump.sh <dump.sql|dump.sql.gz>"
  exit 1
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "❌ Dump no encontrado: $DUMP_FILE"
  exit 1
fi

echo "🚀 Importando dump en $DB_URL"

if [[ "$DUMP_FILE" == *.gz ]]; then
  gunzip -c "$DUMP_FILE" | psql "$DB_URL" -v ON_ERROR_STOP=1
else
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$DUMP_FILE"
fi

echo "✅ Dump importado"
