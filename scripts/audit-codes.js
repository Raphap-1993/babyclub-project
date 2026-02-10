const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wtwnhqbbcocpnqqsybln.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0d25ocWJiY29jcG5xcXN5YmxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzgyNzI0OSwiZXhwIjoyMDc5NDAzMjQ5fQ.cTRQr0H56DEsEu4YsTPDf5PyzPcLiXlZxt5OBDJ0cKg'
);

async function audit() {
  console.log('🔍 Auditando códigos duplicados...\n');
  
  // 1. Códigos generales duplicados
  const { data: codes } = await supabase
    .from('codes')
    .select('id, code, event_id, type, is_active')
    .eq('type', 'general')
    .eq('is_active', true)
    .is('deleted_at', null);
    
  const { data: events } = await supabase
    .from('events')
    .select('id, name, is_active')
    .is('deleted_at', null);
    
  const eventMap = new Map(events?.map(e => [e.id, e.name]) || []);
  const byEvent = new Map();
  
  codes?.forEach(c => {
    if (!byEvent.has(c.event_id)) byEvent.set(c.event_id, []);
    byEvent.get(c.event_id).push(c.code);
  });
  
  console.log('📊 CÓDIGOS GENERALES DUPLICADOS POR EVENTO:\n');
  let foundDups = false;
  byEvent.forEach((cds, evId) => {
    if (cds.length > 1) {
      foundDups = true;
      console.log(`❌ Evento: ${eventMap.get(evId)}`);
      console.log(`   Event ID: ${evId}`);
      console.log(`   Códigos: ${cds.join(', ')}\n`);
    }
  });
  
  if (!foundDups) {
    console.log('✅ No se encontraron códigos generales duplicados\n');
  }
  
  // 2. Eventos sin código
  const eventsWithCode = new Set(codes?.map(c => c.event_id) || []);
  const eventsWithoutCode = events?.filter(e => !eventsWithCode.has(e.id)) || [];
  
  if (eventsWithoutCode.length > 0) {
    console.log('⚠️  EVENTOS SIN CÓDIGO GENERAL:\n');
    eventsWithoutCode.forEach(e => {
      console.log(`   ${e.is_active ? '🟢' : '⚪'} ${e.name}`);
    });
    console.log('');
  }
  
  // 3. Resumen
  console.log('📈 RESUMEN:');
  console.log(`   Total eventos: ${events?.length}`);
  console.log(`   Eventos con código: ${eventsWithCode.size}`);
  console.log(`   Eventos sin código: ${eventsWithoutCode.length}`);
  console.log(`   Total códigos general activos: ${codes?.length}`);
}

audit().catch(console.error);
