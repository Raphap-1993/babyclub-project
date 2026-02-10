/**
 * Ejecutar migración table_availability
 * 
 * Este script crea la tabla table_availability y configura triggers
 * sin eliminar event_id de la tabla tables (implementación gradual)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://wtwnhqbbcocpnqqsybln.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0d25ocWJiY29jcG5xcXN5YmxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzgyNzI0OSwiZXhwIjoyMDc5NDAzMjQ5fQ.cTRQr0H56DEsEu4YsTPDf5PyzPcLiXlZxt5OBDJ0cKg';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function runMigration() {
  console.log('🚀 Iniciando migración table_availability...\n');
  
  try {
    // Paso 1: Crear tabla
    console.log('1️⃣ Creando tabla table_availability...');
    const { error: createError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS table_availability (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
          event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          is_available BOOLEAN NOT NULL DEFAULT true,
          custom_price NUMERIC(10,2),
          custom_min_consumption NUMERIC(10,2),
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          deleted_at TIMESTAMPTZ,
          CONSTRAINT unique_table_event UNIQUE(table_id, event_id)
        );
      `
    });
    
    if (createError) {
      console.log('ℹ️ Tabla ya existe o error:', createError.message);
    } else {
      console.log('✅ Tabla creada');
    }
    
    // Paso 2: Crear índices
    console.log('\n2️⃣ Creando índices...');
    await supabase.rpc('exec', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_table_availability_table_id ON table_availability(table_id) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_table_availability_event_id ON table_availability(event_id) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_table_availability_deleted ON table_availability(deleted_at);
      `
    });
    console.log('✅ Índices creados');
    
    // Paso 3: Migrar datos existentes
    console.log('\n3️⃣ Migrando datos existentes...');
    const { data: migrated } = await supabase.rpc('exec', {
      sql: `
        INSERT INTO table_availability (table_id, event_id, is_available, created_at, updated_at)
        SELECT 
          id as table_id,
          event_id,
          true as is_available,
          created_at,
          now() as updated_at
        FROM tables
        WHERE event_id IS NOT NULL 
          AND deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM table_availability ta 
            WHERE ta.table_id = tables.id 
            AND ta.event_id = tables.event_id
          )
        RETURNING table_id;
      `
    });
    console.log('✅ Datos migrados');
    
    // Paso 4: Verificar
    console.log('\n4️⃣ Verificando migración...');
    const { data: count } = await supabase
      .from('table_availability')
      .select('*', { count: 'exact', head: true });
    console.log(`✅ Registros en table_availability: ${count}`);
    
    console.log('\n🎉 Migración completada exitosamente!');
    console.log('\n📝 Próximos pasos:');
    console.log('   1. Crear APIs para gestionar disponibilidad por evento');
    console.log('   2. Crear pantalla de configuración');
    console.log('   3. Actualizar queries de reservas');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

runMigration();
