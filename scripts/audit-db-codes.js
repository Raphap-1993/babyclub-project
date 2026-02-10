#!/usr/bin/env node

/**
 * Script de auditoría de base de datos
 * Ejecuta análisis del estado actual de la tabla codes
 * Uso: node scripts/audit-db-codes.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Intentar cargar variables de entorno desde múltiples ubicaciones
const envPaths = [
  join(__dirname, '..', '.env.local'),
  join(__dirname, '..', '.env'),
  join(__dirname, '..', 'apps', 'backoffice', '.env.local'),
  join(__dirname, '..', 'apps', 'landing', '.env.local'),
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    console.log(`🔧 Cargando variables desde: ${envPath}`);
    config({ path: envPath });
    break;
  }
}

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Variables de entorno de Supabase no configuradas');
  console.error('   Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  console.error('   en alguno de estos archivos:');
  envPaths.forEach(p => console.error(`   - ${p}`));
  console.error('\n📋 Alternativa: Usa el archivo SQL directamente en Supabase Studio');
  console.error('   Archivo: supabase/migrations/audit-codes-state.sql');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Iniciando auditoría de base de datos...\n');

// Leer el archivo SQL de auditoría
const sqlPath = join(__dirname, '..', 'supabase', 'migrations', 'audit-codes-state.sql');
let auditSQL;

try {
  auditSQL = readFileSync(sqlPath, 'utf-8');
} catch (error) {
  console.error(`❌ Error leyendo ${sqlPath}:`, error.message);
  process.exit(1);
}

// Separar las queries por secciones
const queries = auditSQL
  .split(/-- \d+\./)
  .filter(q => q.trim().length > 0)
  .map(q => q.trim());

async function executeQuery(sql, label) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Intentar ejecutar directamente si rpc no existe
      const { data: directData, error: directError } = await supabase
        .from('codes')
        .select('*')
        .limit(1);
      
      if (directError) {
        console.error(`❌ ${label}: Error -`, directError.message);
        return null;
      }
    }
    
    return data;
  } catch (err) {
    console.error(`❌ ${label}: Excepción -`, err.message);
    return null;
  }
}

// Ejecución manual de queries específicas
async function runAudit() {
  console.log('═'.repeat(80));
  console.log('AUDITORÍA DE CÓDIGOS - ESTADO ACTUAL');
  console.log('═'.repeat(80));
  console.log();

  // 1. Códigos duplicados activos
  console.log('1️⃣  CÓDIGOS DUPLICADOS ACTIVOS');
  console.log('─'.repeat(80));
  const { data: duplicates, error: e1 } = await supabase.rpc('get_duplicate_codes');
  
  if (e1) {
    // Ejecutar query directamente
    const { data: codes } = await supabase
      .from('codes')
      .select('id, code, event_id, deleted_at, events(name)')
      .is('deleted_at', null);
    
    if (codes) {
      const codeMap = new Map();
      codes.forEach(c => {
        const existing = codeMap.get(c.code) || [];
        existing.push(c);
        codeMap.set(c.code, existing);
      });
      
      const dups = Array.from(codeMap.entries())
        .filter(([_, items]) => items.length > 1)
        .map(([code, items]) => ({
          code,
          count: items.length,
          events: items.map(i => i.events?.name || 'Sin nombre').join(', ')
        }));
      
      if (dups.length > 0) {
        console.log(`⚠️  Encontrados ${dups.length} códigos duplicados:\n`);
        dups.forEach(d => {
          console.log(`   • Código "${d.code}": ${d.count} eventos`);
          console.log(`     Eventos: ${d.events}`);
        });
      } else {
        console.log('✅ No se encontraron códigos duplicados');
      }
    }
  } else if (duplicates) {
    console.log(duplicates);
  }
  console.log();

  // 2. Eventos con múltiples códigos generales
  console.log('2️⃣  EVENTOS CON MÚLTIPLES CÓDIGOS GENERALES');
  console.log('─'.repeat(80));
  const { data: multiGeneral } = await supabase
    .from('codes')
    .select('event_id, code, events(name)')
    .eq('type', 'general')
    .eq('is_active', true)
    .is('deleted_at', null);
  
  if (multiGeneral) {
    const eventMap = new Map();
    multiGeneral.forEach(c => {
      const existing = eventMap.get(c.event_id) || [];
      existing.push(c);
      eventMap.set(c.event_id, existing);
    });
    
    const multi = Array.from(eventMap.entries())
      .filter(([_, items]) => items.length > 1);
    
    if (multi.length > 0) {
      console.log(`⚠️  Encontrados ${multi.length} eventos con múltiples códigos generales:\n`);
      multi.forEach(([eventId, codes]) => {
        const eventName = codes[0]?.events?.name || 'Sin nombre';
        console.log(`   • Evento "${eventName}": ${codes.length} códigos`);
        console.log(`     Códigos: ${codes.map(c => c.code).join(', ')}`);
      });
    } else {
      console.log('✅ No se encontraron eventos con múltiples códigos generales');
    }
  }
  console.log();

  // 3. Estadísticas generales
  console.log('3️⃣  ESTADÍSTICAS GENERALES');
  console.log('─'.repeat(80));
  const { count: totalCodes } = await supabase
    .from('codes')
    .select('*', { count: 'exact', head: true });
  
  const { count: activeCodes } = await supabase
    .from('codes')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);
  
  const { count: generalCodes } = await supabase
    .from('codes')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'general')
    .is('deleted_at', null);
  
  console.log(`   Total de códigos: ${totalCodes || 0}`);
  console.log(`   Códigos activos: ${activeCodes || 0}`);
  console.log(`   Códigos soft-deleted: ${(totalCodes || 0) - (activeCodes || 0)}`);
  console.log(`   Códigos generales activos: ${generalCodes || 0}`);
  console.log();

  // 4. Verificar constraints
  console.log('4️⃣  CONSTRAINTS ACTUALES');
  console.log('─'.repeat(80));
  console.log('⚠️  Verificación manual requerida en pgAdmin o Supabase Studio');
  console.log('   Buscar constraint: codes_code_key (UNIQUE global)');
  console.log();

  // 5. Resumen ejecutivo
  console.log('═'.repeat(80));
  console.log('RESUMEN EJECUTIVO');
  console.log('═'.repeat(80));
  
  const hasDuplicates = (await supabase
    .from('codes')
    .select('code')
    .is('deleted_at', null)).data;
  
  const dupCount = hasDuplicates 
    ? new Set(hasDuplicates.map(c => c.code)).size < hasDuplicates.length
    : false;
  
  const eventMap = new Map();
  if (multiGeneral) {
    multiGeneral.forEach(c => {
      const existing = eventMap.get(c.event_id) || [];
      existing.push(c);
      eventMap.set(c.event_id, existing);
    });
  }
  const hasMultiGeneral = Array.from(eventMap.values()).some(codes => codes.length > 1);
  
  if (dupCount || hasMultiGeneral) {
    console.log('🔴 ESTADO: REQUIERE MIGRACIÓN');
    console.log();
    console.log('Problemas detectados:');
    if (dupCount) console.log('   • Códigos duplicados entre eventos');
    if (hasMultiGeneral) console.log('   • Eventos con múltiples códigos generales');
    console.log();
    console.log('Acción recomendada:');
    console.log('   1. Revisar documento: docs/DB-INCONSISTENCIES-REPORT-2026-02-08.md');
    console.log('   2. Aplicar migración: supabase/migrations/2026-02-08-fix-code-uniqueness.sql');
    console.log('   3. Verificar con: node scripts/audit-db-codes.js');
  } else {
    console.log('✅ ESTADO: SALUDABLE');
    console.log('   No se requiere migración en este momento');
  }
  
  console.log('═'.repeat(80));
  console.log();
}

runAudit().catch(err => {
  console.error('❌ Error en auditoría:', err);
  process.exit(1);
});
