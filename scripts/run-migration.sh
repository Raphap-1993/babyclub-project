#!/bin/bash
# Script para ejecutar migración usando la API de Supabase

SUPABASE_URL="https://wtwnhqbbcocpnqqsybln.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0d25ocWJiY29jcG5xcXN5YmxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzgyNzI0OSwiZXhwIjoyMDc5NDAzMjQ5fQ.cTRQr0H56DEsEu4YsTPDf5PyzPcLiXlZxt5OBDJ0cKg"
SQL_FILE="supabase/migrations/2026-02-08-table-availability-parallel.sql"

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
