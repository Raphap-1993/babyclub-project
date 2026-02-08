#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function parseArgs(argv) {
  const args = { env: "apps/backoffice/.env.local" };
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--env" && argv[i + 1]) {
      args.env = argv[i + 1];
      i++;
    }
  }
  return args;
}

function loadEnvFile(envPath) {
  const absPath = path.resolve(envPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Env file not found: ${absPath}`);
  }
  const content = fs.readFileSync(absPath, "utf8");
  for (const lineRaw of content.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function classifyError(error) {
  if (!error) return "unknown";
  const code = `${error.code || ""}`.toUpperCase();
  const message = `${error.message || ""}`.toLowerCase();
  if (code === "42P01" || code === "PGRST205" || message.includes("relation") && message.includes("does not exist")) {
    return "missing_table";
  }
  if (code === "42703" || message.includes("column") && message.includes("does not exist")) {
    return "missing_column";
  }
  return "query_error";
}

async function main() {
  const args = parseArgs(process.argv);
  loadEnvFile(args.env);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env file.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const checks = [
    { table: "events", columns: ["id", "deleted_at", "is_active"] },
    { table: "tickets", columns: ["id", "deleted_at", "is_active"] },
    { table: "codes", columns: ["id", "deleted_at", "is_active"] },
    { table: "tables", columns: ["id", "deleted_at", "is_active"] },
    { table: "table_products", columns: ["id", "deleted_at", "is_active"] },
    { table: "table_reservations", columns: ["id", "deleted_at", "is_active", "status"] },
    { table: "promoters", columns: ["id", "deleted_at", "is_active"] },
    { table: "code_batches", columns: ["id", "deleted_at", "is_active"] },
    { table: "staff", columns: ["id", "deleted_at", "is_active"] },
    { table: "brand_settings", columns: ["id", "logo_url", "deleted_at"] },
    { table: "layout_settings", columns: ["id", "layout_url", "deleted_at"] },
  ];

  let issues = 0;
  console.log(`Checking schema using env: ${args.env}`);

  for (const check of checks) {
    const { error } = await supabase.from(check.table).select(check.columns.join(",")).limit(1);
    if (!error) {
      console.log(`OK   ${check.table}`);
      continue;
    }
    issues++;
    const kind = classifyError(error);
    console.log(`FAIL ${check.table} -> ${kind} (${error.code || "n/a"}): ${error.message}`);
  }

  if (issues > 0) {
    console.log("");
    console.log("Schema issues detected. Suggested actions:");
    console.log("1) Apply soft-delete migration: supabase/migrations/2026-01-31-add-soft-delete.sql");
    console.log("2) Apply branding/layout migration: supabase/migrations/2026-02-07-create-brand-and-layout-settings.sql");
    process.exit(1);
  }

  console.log("");
  console.log("Schema check passed.");
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
