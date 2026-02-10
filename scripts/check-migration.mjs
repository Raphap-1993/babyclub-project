/**
 * Ejecutar migración usando queries individuales
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wtwnhqbbcocpnqqsybln.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0d25ocWJiY29jcG5xcXN5YmxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzgyNzI0OSwiZXhwIjoyMDc5NDAzMjQ5fQ.cTRQr0H56DEsEu4YsTPDf5PyzPcLiXlZxt5OBDJ0cKg';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkTableExists() {
  const { data, error } = await supabase
    .from('table_availability')
    .select('id')
    .limit(1);
  
  return !error;
}

async function runMigration() {
  console.log('🚀 Verificando migración...\n');
  
  const exists = await checkTableExists();
  
  if (exists) {
    console.log('✅ La tabla table_availability ya existe');
    
    // Contar registros
    const { data, count } = await supabase
      .from('table_availability')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Registros en table_availability: ${count || 0}`);
    
    // Verificar estructura
    const { data: sample } = await supabase
      .from('table_availability')
      .select('*')
      .limit(1);
    
    if (sample && sample.length > 0) {
      console.log('\n📋 Ejemplo de registro:');
      console.log(sample[0]);
    }
    
  } else {
    console.log('⚠️ La tabla table_availability NO existe');
    console.log('\nPara ejecutar la migración manualmente:');
    console.log('1. Ve a: https://supabase.com/dashboard/project/wtwnhqbbcocpnqqsybln/editor');
    console.log('2. Abre el SQL Editor');
    console.log('3. Copia y pega el contenido de:');
    console.log('   supabase/migrations/2026-02-08-table-availability-parallel.sql');
    console.log('4. Ejecuta el SQL');
  }
}

runMigration();
