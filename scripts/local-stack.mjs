#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const configDir = path.join(repoRoot, "config", "local");
const nextEnvPatch = path.join(
  repoRoot,
  "scripts",
  "local-disable-next-env.cjs",
);

const serviceOrder = ["landing", "backoffice", "api"];
const serviceConfigs = {
  landing: {
    prefix: "landing",
    command: "pnpm",
    args: ["--filter", "landing", "dev"],
    envFile: path.join(configDir, "landing.env"),
    needsNextPatch: true,
    port: 3001,
  },
  backoffice: {
    prefix: "backoffice",
    command: "pnpm",
    args: ["--filter", "backoffice", "dev"],
    envFile: path.join(configDir, "backoffice.env"),
    needsNextPatch: true,
    port: 3000,
  },
  api: {
    prefix: "api",
    command: "pnpm",
    args: ["--filter", "api", "dev"],
    envFile: path.join(configDir, "api.env"),
    needsNextPatch: false,
    port: 4000,
  },
};

const essentialTables = [
  "events",
  "tickets",
  "codes",
  "persons",
  "staff",
  "promoters",
  "tables",
  "table_products",
  "table_reservations",
  "organizers",
];

function main() {
  const command = process.argv[2] || "up";

  if (command === "up") {
    return up();
  }

  if (command === "supabase") {
    return supabaseOnly();
  }

  if (command === "status") {
    return statusOnly();
  }

  if (command === "env") {
    return envOnly();
  }

  if (command === "down") {
    return down();
  }

  console.error(`Unknown command: ${command}`);
  console.error(
    "Usage: node scripts/local-stack.mjs [up|supabase|status|env|down]",
  );
  process.exit(1);
}

function ensureCommand(command) {
  const probe = spawnSync(command, ["--version"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (probe.error && probe.error.code === "ENOENT") {
    throw new Error(`Required command not found in PATH: ${command}`);
  }
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const content = fs.readFileSync(filePath, "utf8");
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
    env[key] = value;
  }
  return env;
}

function buildSupabaseEnv(status) {
  return {
    SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    SUPABASE_ANON_KEY: status.ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    DATABASE_URL: status.DB_URL,
  };
}

function buildServiceEnv(name, status) {
  const baseEnv = parseEnvFile(path.join(configDir, "base.env"));
  const serviceEnv = parseEnvFile(serviceConfigs[name].envFile);
  const merged = {
    ...process.env,
    ...baseEnv,
    ...serviceEnv,
    ...buildSupabaseEnv(status),
    BABYCLUB_LOCAL_STACK: "1",
  };

  if (serviceConfigs[name].needsNextPatch) {
    merged.BABYCLUB_DISABLE_APP_DOTENV = "1";
    merged.NODE_OPTIONS = appendRequireOption(
      merged.NODE_OPTIONS || "",
      nextEnvPatch,
    );
  }

  return merged;
}

function appendRequireOption(current, modulePath) {
  const normalizedCurrent = current.trim();
  const requireFlag = `--require ${quoteForNodeOption(modulePath)}`;
  if (!normalizedCurrent) {
    return requireFlag;
  }
  if (normalizedCurrent.includes(modulePath)) {
    return normalizedCurrent;
  }
  return `${requireFlag} ${normalizedCurrent}`.trim();
}

function quoteForNodeOption(value) {
  if (!value.includes(" ")) {
    return value;
  }
  return JSON.stringify(value);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      env: options.env || process.env,
      stdio: options.stdio || ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function ensureSupabaseReady() {
  ensureCommand("supabase");
  ensureCommand("pnpm");

  console.log("[local-stack] Starting Supabase local stack (vector excluded)");
  const startResult = await runCommand("supabase", ["start", "-x", "vector"], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (startResult.stdout.trim()) {
    process.stdout.write(startResult.stdout);
  }
  if (startResult.stderr.trim()) {
    process.stderr.write(startResult.stderr);
  }

  let status;
  try {
    status = await readSupabaseStatus();
  } catch (error) {
    throw new Error(
      `Unable to read Supabase status after startup: ${error.message}`,
    );
  }

  if (!status.API_URL || !status.DB_URL || !status.SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase status is incomplete; API_URL, DB_URL or SERVICE_ROLE_KEY is missing.",
    );
  }

  if (startResult.code !== 0) {
    console.warn(
      "[local-stack] supabase start returned a non-zero exit code, but the local services are responding.",
    );
  }

  return status;
}

async function readSupabaseStatus() {
  const result = await runCommand("supabase", ["status", "-o", "json"]);
  if (result.code !== 0) {
    throw new Error(
      result.stderr.trim() || result.stdout.trim() || "supabase status failed",
    );
  }

  const raw = `${result.stdout}\n${result.stderr}`;
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error(`Unexpected supabase status output:\n${raw.trim()}`);
  }

  return JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
}

function detectMissingTables(dbUrl) {
  const sql = `
    select coalesce(string_agg(required_table, ',' order by required_table), '')
    from (
      values ${essentialTables.map((table) => `('${table}')`).join(", ")}
    ) as required(required_table)
    where to_regclass('public.' || required_table) is null;
  `;

  const probe = spawnSync("psql", [dbUrl, "-Atc", sql], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (probe.error) {
    throw probe.error;
  }

  if (probe.status !== 0) {
    throw new Error(probe.stderr.trim() || "psql schema probe failed");
  }

  const raw = probe.stdout.trim();
  return raw ? raw.split(",").filter(Boolean) : [];
}

function printStatusSummary(status, missingTables) {
  console.log(`[local-stack] Supabase API: ${status.API_URL}`);
  console.log(`[local-stack] Supabase Studio: ${status.STUDIO_URL}`);
  console.log(`[local-stack] Supabase DB: ${status.DB_URL}`);

  if (missingTables.length > 0) {
    console.warn("");
    console.warn("[local-stack] Schema blocker detected");
    console.warn(
      `[local-stack] Missing base public tables: ${missingTables.join(", ")}`,
    );
    console.warn(
      "[local-stack] The repo only contains incremental SQL for part of the model; app routes that hit those tables will fail until a base schema dump or canonical initial migration is added.",
    );
    console.warn(
      "[local-stack] Existing supabase/migrations/*.sql are also skipped by the CLI because they do not use the required <timestamp>_name.sql pattern.",
    );
  }
}

function printEffectiveEnv(status) {
  for (const serviceName of serviceOrder) {
    const env = buildServiceEnv(serviceName, status);
    console.log(`# ${serviceName}`);
    const keys = Object.keys(env)
      .filter((key) =>
        [
          "BABYCLUB_LOCAL_STACK",
          "BABYCLUB_DISABLE_APP_DOTENV",
          "DATABASE_URL",
          "NEXT_PUBLIC_API_URL",
          "NEXT_PUBLIC_APP_URL",
          "NEXT_PUBLIC_LANDING_URL",
          "NEXT_PUBLIC_ORGANIZER_ID",
          "NEXT_PUBLIC_ORGANIZER_NAME",
          "NEXT_PUBLIC_SUPABASE_ANON_KEY",
          "NEXT_PUBLIC_SUPABASE_URL",
          "NODE_OPTIONS",
          "PORT",
          "PUBLIC_API_BASE",
          "SUPABASE_ANON_KEY",
          "SUPABASE_SERVICE_ROLE_KEY",
          "SUPABASE_URL",
        ].includes(key),
      )
      .sort();

    for (const key of keys) {
      console.log(`${key}=${env[key]}`);
    }
    console.log("");
  }
}

function assertAppPortsAvailable() {
  for (const serviceName of serviceOrder) {
    const { port } = serviceConfigs[serviceName];
    const probe = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (probe.error && probe.error.code === "ENOENT") {
      continue;
    }

    if (probe.status === 0 && probe.stdout.trim()) {
      const details = probe.stdout.trim().split(/\r?\n/).slice(1).join(" | ");
      throw new Error(
        `Port ${port} is already in use; cannot start ${serviceName}. Listener: ${details}`,
      );
    }
  }
}

function pipeStream(stream, prefix, target) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      target.write(`[${prefix}] ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buffer) {
      target.write(`[${prefix}] ${buffer}\n`);
    }
  });
}

async function runApps(status) {
  const children = [];
  let shuttingDown = false;

  const stopChildren = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
      if (!child.killed) {
        child.kill(signal);
      }
    }
  };

  process.on("SIGINT", () => {
    stopChildren("SIGINT");
  });
  process.on("SIGTERM", () => {
    stopChildren("SIGTERM");
  });

  const exits = serviceOrder.map((serviceName) => {
    const config = serviceConfigs[serviceName];
    const child = spawn(config.command, config.args, {
      cwd: repoRoot,
      env: buildServiceEnv(serviceName, status),
      stdio: ["ignore", "pipe", "pipe"],
    });

    children.push(child);
    pipeStream(child.stdout, config.prefix, process.stdout);
    pipeStream(child.stderr, config.prefix, process.stderr);

    return new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code, signal) => {
        resolve({ code, signal, serviceName });
      });
    });
  });

  console.log("");
  console.log("[local-stack] Starting application processes");
  console.log("[local-stack] landing -> http://localhost:3001");
  console.log("[local-stack] backoffice -> http://localhost:3000");
  console.log("[local-stack] api -> http://localhost:4000");
  console.log("[local-stack] Press Ctrl+C to stop the local stack");

  const firstExit = await Promise.race(exits);
  stopChildren("SIGTERM");

  const remainingExits = await Promise.allSettled(exits);
  const hasFailure = remainingExits.some((result) => {
    return (
      result.status === "fulfilled" &&
      result.value.code &&
      result.value.code !== 0
    );
  });

  if (firstExit.signal) {
    return;
  }

  if (firstExit.code !== 0 || hasFailure) {
    throw new Error(
      `${firstExit.serviceName} exited with code ${firstExit.code ?? "unknown"}`,
    );
  }
}

async function up() {
  const status = await ensureSupabaseReady();
  const missingTables = detectMissingTables(status.DB_URL);
  printStatusSummary(status, missingTables);
  assertAppPortsAvailable();
  await runApps(status);
}

async function supabaseOnly() {
  const status = await ensureSupabaseReady();
  const missingTables = detectMissingTables(status.DB_URL);
  printStatusSummary(status, missingTables);
}

async function statusOnly() {
  let status;
  try {
    status = await readSupabaseStatus();
  } catch (error) {
    throw new Error(
      `${error.message}\nRun "pnpm local:stack:supabase" to start the local Supabase services first.`,
    );
  }
  const missingTables = detectMissingTables(status.DB_URL);
  printStatusSummary(status, missingTables);
}

async function envOnly() {
  const status = await ensureSupabaseReady();
  printEffectiveEnv(status);
}

async function down() {
  ensureCommand("supabase");
  const result = await runCommand("supabase", ["stop"]);
  if (result.stdout.trim()) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr.trim()) {
    process.stderr.write(result.stderr);
  }
  if (result.code !== 0) {
    throw new Error("supabase stop failed");
  }
}

main().catch((error) => {
  console.error(`[local-stack] ${error.message}`);
  process.exit(1);
});
