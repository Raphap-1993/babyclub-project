#!/usr/bin/env node
/**
 * Script para ejecutar migración SQL en Supabase
 * Uso: node scripts/run-migration.js <archivo-sql>
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const sqlFile =
  process.argv[2] ||
  "supabase/migrations/2026-02-08-table-availability-parallel.sql";
const sqlPath = resolve(process.cwd(), sqlFile);

console.log("🚀 Ejecutando migración:", sqlPath);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (
  process.env.ALLOW_REMOTE_DB !== "true" &&
  !SUPABASE_URL.startsWith("http://127.0.0.1:") &&
  !SUPABASE_URL.startsWith("http://localhost:")
) {
  console.error(
    "❌ Seguridad: este script no ejecuta SQL contra un Supabase remoto salvo que ALLOW_REMOTE_DB=true",
  );
  process.exit(1);
}

try {
  const sqlContent = readFileSync(sqlPath, "utf-8");
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Ejecutar el SQL
  const { data, error } = await supabase.rpc("exec", { sql: sqlContent });

  if (error) {
    console.error("❌ Error ejecutando migración:", error);
    process.exit(1);
  }

  console.log("✅ Migración completada exitosamente");
  console.log("Resultado:", data);
} catch (err) {
  console.error("❌ Error:", err.message);
  process.exit(1);
}
