#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const rootDir = process.cwd();
const defaultLocalEnvPath = path.join(rootDir, ".local/supabase.local.env");

function parseArgs(argv) {
  const options = {
    localEnv: defaultLocalEnvPath,
    email: process.env.LOCAL_ADMIN_EMAIL || "",
    password: process.env.LOCAL_ADMIN_PASSWORD || "",
    firstName: process.env.LOCAL_ADMIN_FIRST_NAME || "Local",
    lastName: process.env.LOCAL_ADMIN_LAST_NAME || "Admin",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--local-env") {
      options.localEnv = path.resolve(rootDir, argv[index + 1] || "");
      index += 1;
      continue;
    }

    if (arg === "--email") {
      options.email = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--password") {
      options.password = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--first-name") {
      options.firstName = argv[index + 1] || options.firstName;
      index += 1;
      continue;
    }

    if (arg === "--last-name") {
      options.lastName = argv[index + 1] || options.lastName;
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!options.email || !options.password) {
    printHelp();
    process.exit(1);
  }

  return options;
}

function printHelp() {
  console.log(`Uso:
  node scripts/local/create-backoffice-admin.mjs --email <email> --password <password> [opciones]

Opciones:
  --local-env <path>    Archivo con API_URL/SERVICE_ROLE_KEY locales
  --first-name <text>   Nombre del admin local
  --last-name <text>    Apellido del admin local
`);
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe el archivo de entorno: ${filePath}`);
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

async function listAllUsers(client) {
  const users = [];
  let page = 1;

  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw new Error(`No se pudieron listar los usuarios locales: ${error.message}`);
    }

    const batch = data?.users || [];
    users.push(...batch);

    if (batch.length < 1000) {
      break;
    }

    page += 1;
  }

  return users;
}

async function ensureLocalAuthUser(client, email, password) {
  const users = await listAllUsers(client);
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = users.find((user) => (user.email || "").toLowerCase() === normalizedEmail);

  if (existingUser) {
    const { data, error } = await client.auth.admin.updateUserById(existingUser.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...(existingUser.user_metadata || {}),
        role: "admin",
      },
    });
    if (error) {
      throw new Error(`No se pudo actualizar el usuario auth local: ${error.message}`);
    }
    return data.user;
  }

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "admin" },
  });

  if (error || !data?.user) {
    throw new Error(error?.message || "No se pudo crear el usuario auth local");
  }

  return data.user;
}

async function ensurePerson(client, email, firstName, lastName) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data: existing, error: existingError } = await client
    .from("persons")
    .select("id")
    .eq("email", normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`No se pudo consultar persons: ${existingError.message}`);
  }

  if (existing?.id) {
    return existing.id;
  }

  const id = crypto.randomUUID();
  const { error: insertError } = await client.from("persons").insert({
    id,
    first_name: firstName,
    last_name: lastName,
    email: normalizedEmail,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (insertError) {
    throw new Error(`No se pudo crear la persona local: ${insertError.message}`);
  }

  return id;
}

async function ensureAdminRole(client) {
  const { data, error } = await client
    .from("staff_roles")
    .select("id,code")
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`No se pudieron leer staff_roles: ${error.message}`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No existen staff_roles en la BD local clonada.");
  }

  const normalized = data.map((role) => ({
    ...role,
    normalizedCode: String(role.code || "").trim().toLowerCase(),
  }));

  return (
    normalized.find((role) => role.normalizedCode === "superadmin") ||
    normalized.find((role) => role.normalizedCode === "admin") ||
    normalized[0]
  );
}

async function ensureStaff(client, authUserId, personId, roleId) {
  const { data: existingStaff, error: existingError } = await client
    .from("staff")
    .select("id")
    .or(`auth_user_id.eq.${authUserId},person_id.eq.${personId}`)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`No se pudo consultar staff: ${existingError.message}`);
  }

  const payload = {
    auth_user_id: authUserId,
    person_id: personId,
    staff_role_id: roleId,
    is_active: true,
    deleted_at: null,
    deleted_by: null,
    created_at: new Date().toISOString(),
  };

  if (existingStaff?.id) {
    const { error: updateError } = await client.from("staff").update(payload).eq("id", existingStaff.id);
    if (updateError) {
      throw new Error(`No se pudo actualizar el staff local: ${updateError.message}`);
    }
    return existingStaff.id;
  }

  const id = crypto.randomUUID();
  const { error: insertError } = await client.from("staff").insert({
    id,
    ...payload,
  });

  if (insertError) {
    throw new Error(`No se pudo crear el staff local: ${insertError.message}`);
  }

  return id;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const localEnv = readEnvFile(options.localEnv);

  const apiUrl = localEnv.API_URL;
  const serviceRoleKey = localEnv.SERVICE_ROLE_KEY;
  if (!apiUrl || !serviceRoleKey) {
    throw new Error(`Faltan API_URL/SERVICE_ROLE_KEY en ${options.localEnv}`);
  }

  const client = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authUser = await ensureLocalAuthUser(client, options.email, options.password);
  const personId = await ensurePerson(client, options.email, options.firstName, options.lastName);
  const adminRole = await ensureAdminRole(client);
  const staffId = await ensureStaff(client, authUser.id, personId, adminRole.id);

  console.log("Admin local listo.");
  console.log(` - email: ${options.email}`);
  console.log(` - role: ${adminRole.code}`);
  console.log(` - staff_id: ${staffId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
