#!/usr/bin/env node
/**
 * Script para ejecutar migración SQL en Supabase
 * Uso: node scripts/run-migration.js <archivo-sql>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = 'https://wtwnhqbbcocpnqqsybln.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0d25ocWJiY29jcG5xcXN5YmxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzgyNzI0OSwiZXhwIjoyMDc5NDAzMjQ5fQ.cTRQr0H56DEsEu4YsTPDf5PyzPcLiXlZxt5OBDJ0cKg';

const sqlFile = process.argv[2] || 'supabase/migrations/2026-02-08-table-availability-parallel.sql';
const sqlPath = resolve(process.cwd(), sqlFile);

console.log('🚀 Ejecutando migración:', sqlPath);

try {
  const sqlContent = readFileSync(sqlPath, 'utf-8');
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  
  // Ejecutar el SQL
  const { data, error } = await supabase.rpc('exec', { sql: sqlContent });
  
  if (error) {
    console.error('❌ Error ejecutando migración:', error);
    process.exit(1);
  }
  
  console.log('✅ Migración completada exitosamente');
  console.log('Resultado:', data);
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
