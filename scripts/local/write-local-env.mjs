#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

function readEnvFile(relativePath) {
  const absPath = path.join(rootDir, relativePath);
  const values = new Map();

  if (!existsSync(absPath)) {
    return values;
  }

  const content = readFileSync(absPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    values.set(key, value);
  }

  return values;
}

function parseSupabaseStatusEnv(stdout) {
  const env = new Map();

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("Stopped services:")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    env.set(key, value);
  }

  return env;
}

function envBlock(entries) {
  return `${entries.map(([key, value]) => `${key}=${value}`).join("\n")}\n`;
}

const supabaseRaw = execFileSync("supabase", ["status", "-o", "env"], {
  cwd: rootDir,
  encoding: "utf8",
});
const supabaseEnv = parseSupabaseStatusEnv(supabaseRaw);

const apiUrl = supabaseEnv.get("API_URL");
const anonKey = supabaseEnv.get("ANON_KEY");
const serviceRoleKey = supabaseEnv.get("SERVICE_ROLE_KEY");

if (!apiUrl || !anonKey || !serviceRoleKey) {
  console.error(
    "No se pudo resolver API_URL/ANON_KEY/SERVICE_ROLE_KEY desde `supabase status -o env`.",
  );
  process.exit(1);
}

const landingRemote = readEnvFile("apps/landing/.env.local");
const backofficeRemote = readEnvFile("apps/backoffice/.env.local");

const landingEnv = [
  ["SUPABASE_URL", "http://host.docker.internal:54321"],
  ["SUPABASE_ANON_KEY", anonKey],
  ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
  ["NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey],
  ["NEXT_PUBLIC_APP_URL", "http://localhost:3001"],
  [
    "NEXT_PUBLIC_DEFAULT_CODE",
    landingRemote.get("NEXT_PUBLIC_DEFAULT_CODE") || "",
  ],
  ["NEXT_PUBLIC_LOGO_URL", landingRemote.get("NEXT_PUBLIC_LOGO_URL") || ""],
  [
    "NEXT_PUBLIC_REGISTRO_COVER_URL",
    landingRemote.get("NEXT_PUBLIC_REGISTRO_COVER_URL") || "",
  ],
  [
    "NEXT_PUBLIC_TABLE_LAYOUT_URL",
    landingRemote.get("NEXT_PUBLIC_TABLE_LAYOUT_URL") || "",
  ],
  [
    "NEXT_PUBLIC_MAP_ENABLE_ZOOM",
    landingRemote.get("NEXT_PUBLIC_MAP_ENABLE_ZOOM") || "false",
  ],
  [
    "NEXT_PUBLIC_MAP_DEBUG",
    landingRemote.get("NEXT_PUBLIC_MAP_DEBUG") || "false",
  ],
  [
    "NEXT_PUBLIC_ORGANIZER_ID",
    landingRemote.get("NEXT_PUBLIC_ORGANIZER_ID") || "",
  ],
  [
    "NEXT_PUBLIC_ORGANIZER_NAME",
    landingRemote.get("NEXT_PUBLIC_ORGANIZER_NAME") || "BABY",
  ],
  ["API_PERU_TOKEN", ""],
  ["RESEND_API_KEY", ""],
  ["RESEND_FROM", ""],
  ["ENABLE_ONLINE_PAYMENTS", "false"],
  ["PAYMENT_METHOD", "reservation"],
  [
    "NEXT_PUBLIC_TICKET_SALE_PHASE",
    landingRemote.get("NEXT_PUBLIC_TICKET_SALE_PHASE") || "early_bird",
  ],
  [
    "NEXT_PUBLIC_EARLY_BIRD_ENDS_LABEL",
    landingRemote.get("NEXT_PUBLIC_EARLY_BIRD_ENDS_LABEL") ||
      "13 feb, 11:59 p. m.",
  ],
  ["TICKET_SALE_PHASE", ""],
  ["IZIPAY_MERCHANT_ID", ""],
  ["IZIPAY_ACCESS_KEY", ""],
  ["IZIPAY_SECRET_KEY", ""],
  ["IZIPAY_API_BASE_URL", "https://apisandbox.vnforappstest.com"],
  ["ENABLE_CULQI_PAYMENTS", "false"],
  ["NEXT_PUBLIC_CULQI_ENABLED", "false"],
  ["NEXT_PUBLIC_CULQI_PUBLIC_KEY", ""],
  ["CULQI_SECRET_KEY", ""],
  ["CULQI_WEBHOOK_SECRET", ""],
  ["CULQI_API_BASE_URL", "https://api.culqi.com/v2"],
  ["PUBLIC_API_BASE", "http://host.docker.internal:4000"],
  [
    "RATE_LIMIT_PERSONS_PER_MIN",
    landingRemote.get("RATE_LIMIT_PERSONS_PER_MIN") || "20",
  ],
  [
    "RATE_LIMIT_RENIEC_PER_MIN",
    landingRemote.get("RATE_LIMIT_RENIEC_PER_MIN") || "20",
  ],
  [
    "RATE_LIMIT_UPLOADS_VOUCHER_PER_MIN",
    landingRemote.get("RATE_LIMIT_UPLOADS_VOUCHER_PER_MIN") || "10",
  ],
  [
    "RATE_LIMIT_TICKETS_EMAIL_PER_MIN",
    landingRemote.get("RATE_LIMIT_TICKETS_EMAIL_PER_MIN") || "10",
  ],
];

const backofficeEnv = [
  ["SUPABASE_URL", "http://host.docker.internal:54321"],
  ["SUPABASE_ANON_KEY", anonKey],
  ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
  ["NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey],
  ["NEXT_PUBLIC_LANDING_URL", "http://localhost:3001"],
  ["API_PERU_TOKEN", ""],
  ["RESEND_API_KEY", ""],
  ["RESEND_FROM", ""],
  ["ENABLE_CULQI_PAYMENTS", "false"],
  ["CULQI_SECRET_KEY", ""],
  ["CULQI_API_BASE_URL", "https://api.culqi.com/v2"],
  [
    "RATE_LIMIT_SCAN_PER_MIN",
    backofficeRemote.get("RATE_LIMIT_SCAN_PER_MIN") || "120",
  ],
];

const apiEnv = [
  ["PORT", "4000"],
  ["PUBLIC_API_BASE", "http://localhost:4000"],
];

writeFileSync(
  path.join(rootDir, "apps/landing/.env.local.localstack"),
  envBlock(landingEnv),
);
writeFileSync(
  path.join(rootDir, "apps/backoffice/.env.local.localstack"),
  envBlock(backofficeEnv),
);
writeFileSync(
  path.join(rootDir, "apps/api/.env.local.localstack"),
  envBlock(apiEnv),
);

mkdirSync(path.join(rootDir, ".local"), { recursive: true });
writeFileSync(
  path.join(rootDir, ".local/supabase.local.env"),
  envBlock([
    ["API_URL", apiUrl],
    ["ANON_KEY", anonKey],
    ["SERVICE_ROLE_KEY", serviceRoleKey],
    ["DB_URL", supabaseEnv.get("DB_URL") || ""],
    ["STUDIO_URL", supabaseEnv.get("STUDIO_URL") || ""],
    ["INBUCKET_URL", supabaseEnv.get("INBUCKET_URL") || ""],
  ]),
);

console.log("Local env files generated:");
console.log(" - apps/landing/.env.local.localstack");
console.log(" - apps/backoffice/.env.local.localstack");
console.log(" - apps/api/.env.local.localstack");
console.log(" - .local/supabase.local.env");
