#!/bin/bash
# Script para ejecutar migración usando la API de Supabase

set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
SQL_FILE="supabase/migrations/2026-02-08-table-availability-parallel.sql"

if [[ -z "$SUPABASE_URL" || -z "$SERVICE_KEY" ]]; then
  echo "❌ Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno"
  exit 1
fi

if [[ "${ALLOW_REMOTE_DB:-false}" != "true" && "$SUPABASE_URL" != http://127.0.0.1:* && "$SUPABASE_URL" != http://localhost:* ]]; then
  echo "❌ Seguridad: este script no ejecuta SQL contra un Supabase remoto salvo que ALLOW_REMOTE_DB=true"
  exit 1
fi

echo "🚀 Ejecutando migración: $SQL_FILE"
echo ""

# Leer el archivo SQL
SQL_CONTENT=$(cat "$SQL_FILE")

# Ejecutar usando curl a través de PostgREST
curl -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}"

echo ""
echo "✅ Migración completada"
