/**
 * Ejecutar migración usando queries individuales
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkTableExists() {
  const { data, error } = await supabase
    .from("table_availability")
    .select("id")
    .limit(1);

  return !error;
}

async function runMigration() {
  console.log("🚀 Verificando migración...\n");

  const exists = await checkTableExists();

  if (exists) {
    console.log("✅ La tabla table_availability ya existe");

    // Contar registros
    const { data, count } = await supabase
      .from("table_availability")
      .select("*", { count: "exact", head: true });

    console.log(`📊 Registros en table_availability: ${count || 0}`);

    // Verificar estructura
    const { data: sample } = await supabase
      .from("table_availability")
      .select("*")
      .limit(1);

    if (sample && sample.length > 0) {
      console.log("\n📋 Ejemplo de registro:");
      console.log(sample[0]);
    }
  } else {
    console.log("⚠️ La tabla table_availability NO existe");
    console.log("\nPara ejecutar la migración manualmente:");
    console.log(
      "1. Usa un entorno con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY válidos",
    );
    console.log(
      "2. Ejecuta scripts/run-migration.sh o scripts/run-migration.mjs",
    );
    console.log("3. Si el target es remoto, exige ALLOW_REMOTE_DB=true");
  }
}

runMigration();
