#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const rootDir = process.cwd();
const defaultRemoteEnvPath = path.join(rootDir, "apps/backoffice/.env.local");
const defaultLocalEnvPath = path.join(rootDir, ".local/supabase.local.env");
const defaultOutDir = path.join(rootDir, ".local/clone");
const pageSize = 1000;

const compositePrimaryKeys = new Map([
  ["event_messages", ["event_id", "key"]],
  ["person_type_links", ["person_id", "person_type_id"]],
  ["staff_role_permissions", ["staff_role_id", "permission_id"]],
]);

function parseArgs(argv) {
  const options = {
    remoteEnv: defaultRemoteEnvPath,
    localEnv: defaultLocalEnvPath,
    outDir: defaultOutDir,
    apply: true,
    schemaOnly: false,
    dataOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--remote-env") {
      options.remoteEnv = path.resolve(rootDir, argv[index + 1] || "");
      index += 1;
      continue;
    }

    if (arg === "--local-env") {
      options.localEnv = path.resolve(rootDir, argv[index + 1] || "");
      index += 1;
      continue;
    }

    if (arg === "--out-dir") {
      options.outDir = path.resolve(rootDir, argv[index + 1] || "");
      index += 1;
      continue;
    }

    if (arg === "--no-apply") {
      options.apply = false;
      continue;
    }

    if (arg === "--schema-only") {
      options.schemaOnly = true;
      continue;
    }

    if (arg === "--data-only") {
      options.dataOnly = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (options.schemaOnly && options.dataOnly) {
    console.error("No puedes combinar --schema-only y --data-only.");
    process.exit(1);
  }

  return options;
}

function printHelp() {
  console.log(`Uso:
  node scripts/local/clone-remote-public.mjs [opciones]

Opciones:
  --remote-env <path>   Archivo con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY remotos
  --local-env <path>    Archivo con DB_URL local (default: .local/supabase.local.env)
  --out-dir <path>      Carpeta donde guardar schema/data/sql generados
  --schema-only         Solo genera/aplica schema
  --data-only           Solo genera/aplica datos
  --no-apply            Genera archivos pero no los aplica en la BD local
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

function getProjectRefFromUrl(url) {
  const match = url.match(/^https:\/\/([^.]+)\.supabase\.co$/);
  return match?.[1] || null;
}

function runSupabaseGenTypes(projectRef) {
  return execFileSync(
    "supabase",
    ["gen", "types", "typescript", "--project-id", projectRef, "--schema", "public"],
    { cwd: rootDir, encoding: "utf8" },
  );
}

function parseQuotedArray(rawArray = "") {
  const values = [];
  const regex = /"([^"]+)"/g;
  let match = regex.exec(rawArray);
  while (match) {
    values.push(match[1]);
    match = regex.exec(rawArray);
  }
  return values;
}

function extractTableBlocks(typesSource) {
  const tablesMatch = typesSource.match(/^\s{4}Tables: \{\n([\s\S]*?)^\s{4}Views: \{/m);
  if (!tablesMatch) {
    throw new Error("No se pudo extraer el bloque Tables del schema remoto.");
  }

  const tablesBlock = tablesMatch[1];
  const tableRegex = /^\s{6}(\w+): \{\n([\s\S]*?)^\s{6}\},?$/gm;
  const blocks = [];
  let match = tableRegex.exec(tablesBlock);
  while (match) {
    blocks.push({ name: match[1], body: match[2] });
    match = tableRegex.exec(tablesBlock);
  }
  return blocks;
}

function parseColumnsFromBody(tableBody) {
  const rowMatch = tableBody.match(/^\s{8}Row: \{\n([\s\S]*?)^\s{8}\}/m);
  if (!rowMatch) {
    return [];
  }

  const columns = [];
  const columnRegex = /^\s{10}(\w+): (.+)$/gm;
  let match = columnRegex.exec(rowMatch[1]);
  while (match) {
    columns.push({
      name: match[1],
      tsType: match[2].trim(),
      nullable: match[2].includes("| null"),
    });
    match = columnRegex.exec(rowMatch[1]);
  }
  return columns;
}

function parseRelationshipsFromBody(tableBody) {
  if (tableBody.includes("Relationships: []")) {
    return [];
  }

  const relationshipsMatch = tableBody.match(/^\s{8}Relationships: \[\n([\s\S]*?)^\s{8}\]/m);
  if (!relationshipsMatch) {
    return [];
  }

  const relationships = [];
  const relationshipRegex = /^\s{10}\{\n([\s\S]*?)^\s{10}\},?$/gm;
  let match = relationshipRegex.exec(relationshipsMatch[1]);
  while (match) {
    const block = match[1];
    const columns = parseQuotedArray(block.match(/^\s{12}columns: \[(.*)\]/m)?.[1] || "");
    const referencedColumns = parseQuotedArray(
      block.match(/^\s{12}referencedColumns: \[(.*)\]/m)?.[1] || "",
    );
    const referencedRelation =
      block.match(/^\s{12}referencedRelation: "([^"]+)"/m)?.[1] || null;

    relationships.push({
      columns,
      referencedColumns,
      referencedRelation,
    });

    match = relationshipRegex.exec(relationshipsMatch[1]);
  }
  return relationships;
}

function parseRemoteSchema(typesSource) {
  const blocks = extractTableBlocks(typesSource);
  const tables = blocks.map(({ name, body }) => ({
    name,
    columns: parseColumnsFromBody(body),
    relationships: parseRelationshipsFromBody(body),
  }));

  const knownTables = new Set(tables.map((table) => table.name));

  for (const table of tables) {
    table.relationships = table.relationships.filter(
      (relationship) =>
        relationship.referencedRelation &&
        knownTables.has(relationship.referencedRelation) &&
        relationship.columns.length > 0 &&
        relationship.referencedColumns.length > 0,
    );
  }

  return tables;
}

function inferSqlType(column) {
  const normalized = column.tsType.replace(/\s+/g, " ").trim();
  const columnName = column.name;

  if (normalized.includes("Json")) {
    return "jsonb";
  }

  if (normalized.startsWith("string[]")) {
    return "text[]";
  }

  if (normalized.startsWith("number[]")) {
    return "numeric[]";
  }

  if (normalized.startsWith("boolean[]")) {
    return "boolean[]";
  }

  if (normalized.startsWith("boolean")) {
    return "boolean";
  }

  if (normalized.startsWith("number")) {
    if (
      /(^id$|_id$|(^|_)(count|quantity|uses|sort_order|min_age|max_uses|capacity|marketing_capacity|ticket_count|person_index)$)/.test(
        columnName,
      )
    ) {
      return "integer";
    }
    if (/(price|amount|consumption|vat)/.test(columnName)) {
      return "numeric";
    }
    return "numeric";
  }

  if (normalized.startsWith("string")) {
    if (columnName === "birthdate") {
      return "date";
    }
    if (/_at$/.test(columnName) || columnName === "starts_at" || columnName === "expires_at") {
      return "timestamptz";
    }
    return "text";
  }

  return "text";
}

function getPrimaryKeyColumns(table) {
  if (compositePrimaryKeys.has(table.name)) {
    return compositePrimaryKeys.get(table.name);
  }
  if (table.columns.some((column) => column.name === "id")) {
    return ["id"];
  }
  return [];
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function buildSchemaSql(tables, metadata) {
  const dropOrder = [...tables].reverse();
  const lines = [
    "-- ============================================================",
    `-- BabyClub public schema clone`,
    `-- Source project: ${metadata.projectRef}`,
    `-- Generated at: ${new Date().toISOString()}`,
    "-- ============================================================",
    "",
    "CREATE SCHEMA IF NOT EXISTS public;",
    "",
  ];

  for (const table of dropOrder) {
    lines.push(`DROP TABLE IF EXISTS public.${quoteIdentifier(table.name)} CASCADE;`);
  }

  lines.push("");

  for (const table of tables) {
    const primaryKey = getPrimaryKeyColumns(table);
    const columnLines = table.columns.map((column) => {
      const sqlType = inferSqlType(column);
      const nullable = column.nullable ? "" : " NOT NULL";
      return `  ${quoteIdentifier(column.name)} ${sqlType}${nullable}`;
    });

    if (primaryKey.length > 0) {
      columnLines.push(
        `  PRIMARY KEY (${primaryKey.map((column) => quoteIdentifier(column)).join(", ")})`,
      );
    }

    lines.push(`CREATE TABLE public.${quoteIdentifier(table.name)} (`);
    lines.push(columnLines.join(",\n"));
    lines.push(");");
    lines.push("");
  }

  for (const table of tables) {
    let constraintIndex = 1;
    for (const relationship of table.relationships) {
      const constraintName = `${table.name}_${constraintIndex}_fk`;
      lines.push(
        `ALTER TABLE public.${quoteIdentifier(table.name)} ADD CONSTRAINT ${quoteIdentifier(
          constraintName,
        )} FOREIGN KEY (${relationship.columns
          .map((column) => quoteIdentifier(column))
          .join(", ")}) REFERENCES public.${quoteIdentifier(
          relationship.referencedRelation,
        )} (${relationship.referencedColumns
          .map((column) => quoteIdentifier(column))
          .join(", ")});`,
      );
      constraintIndex += 1;
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function topologicalSortTables(tables) {
  const tableMap = new Map(tables.map((table) => [table.name, table]));
  const incoming = new Map(tables.map((table) => [table.name, 0]));
  const outgoing = new Map(tables.map((table) => [table.name, new Set()]));

  for (const table of tables) {
    for (const relationship of table.relationships) {
      if (!tableMap.has(relationship.referencedRelation)) continue;
      if (relationship.referencedRelation === table.name) continue;
      if (!outgoing.get(relationship.referencedRelation).has(table.name)) {
        outgoing.get(relationship.referencedRelation).add(table.name);
        incoming.set(table.name, (incoming.get(table.name) || 0) + 1);
      }
    }
  }

  const queue = tables
    .filter((table) => (incoming.get(table.name) || 0) === 0)
    .map((table) => table.name);

  const sorted = [];
  while (queue.length > 0) {
    const currentName = queue.shift();
    sorted.push(tableMap.get(currentName));

    for (const childName of outgoing.get(currentName) || []) {
      const nextIncoming = (incoming.get(childName) || 0) - 1;
      incoming.set(childName, nextIncoming);
      if (nextIncoming === 0) {
        queue.push(childName);
      }
    }
  }

  if (sorted.length !== tables.length) {
    return tables;
  }

  return sorted;
}

function buildOrderColumns(table) {
  const primaryKey = getPrimaryKeyColumns(table);
  if (primaryKey.length > 0) return primaryKey;
  if (table.columns.some((column) => column.name === "created_at")) return ["created_at"];
  if (table.columns.length > 0) return [table.columns[0].name];
  return [];
}

async function fetchTableRows(remoteClient, table) {
  const orderColumns = buildOrderColumns(table);
  const rows = [];
  let from = 0;

  for (;;) {
    let query = remoteClient.from(table.name).select("*");
    for (const columnName of orderColumns) {
      query = query.order(columnName, { ascending: true });
    }
    query = query.range(from, from + pageSize - 1);

    const { data, error } = await query;
    if (error) {
      throw new Error(`No se pudo leer ${table.name}: ${error.message}`);
    }

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function serializeArray(values, sqlType) {
  const baseType = sqlType.replace(/\[\]$/, "");
  const members = values.map((value) => serializeLiteral(value, baseType));
  return `ARRAY[${members.join(", ")}]::${sqlType}`;
}

function serializeLiteral(value, sqlType) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (sqlType.endsWith("[]")) {
    return serializeArray(value, sqlType);
  }

  if (sqlType === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (sqlType === "integer" || sqlType === "numeric") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }

  if (sqlType === "jsonb") {
    return `'${escapeSqlString(JSON.stringify(value))}'::jsonb`;
  }

  return `'${escapeSqlString(value)}'`;
}

function buildDataSql(tables, tableRows, metadata) {
  const lines = [
    "-- ============================================================",
    `-- BabyClub public data clone`,
    `-- Source project: ${metadata.projectRef}`,
    `-- Generated at: ${new Date().toISOString()}`,
    "-- ============================================================",
    "",
    "SET session_replication_role = replica;",
    "",
  ];

  for (const table of [...tables].reverse()) {
    lines.push(`TRUNCATE TABLE public.${quoteIdentifier(table.name)} CASCADE;`);
  }

  lines.push("");

  for (const table of tables) {
    const rows = tableRows.get(table.name) || [];
    lines.push(`-- ${table.name}: ${rows.length} filas`);

    if (rows.length === 0) {
      lines.push("");
      continue;
    }

    const columns = table.columns.map((column) => column.name);
    const sqlTypes = new Map(table.columns.map((column) => [column.name, inferSqlType(column)]));
    const batches = [];

    for (let index = 0; index < rows.length; index += 250) {
      batches.push(rows.slice(index, index + 250));
    }

    for (const batch of batches) {
      const values = batch
        .map((row) => {
          const items = columns.map((columnName) =>
            serializeLiteral(row[columnName], sqlTypes.get(columnName) || "text"),
          );
          return `  (${items.join(", ")})`;
        })
        .join(",\n");

      lines.push(
        `INSERT INTO public.${quoteIdentifier(table.name)} (${columns
          .map((columnName) => quoteIdentifier(columnName))
          .join(", ")}) VALUES\n${values};`,
      );
      lines.push("");
    }
  }

  lines.push("SET session_replication_role = DEFAULT;");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function exportRemoteAuthUsers(remoteClient) {
  const users = [];
  let page = 1;

  for (;;) {
    const { data, error } = await remoteClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(`No se pudieron listar usuarios auth remotos: ${error.message}`);
    }

    const batch = data?.users || [];
    for (const user of batch) {
      users.push({
        id: user.id,
        email: user.email || null,
        role: user.role || null,
        created_at: user.created_at || null,
        last_sign_in_at: user.last_sign_in_at || null,
        app_metadata: user.app_metadata || {},
        user_metadata: user.user_metadata || {},
      });
    }

    if (batch.length < 1000) {
      break;
    }

    page += 1;
  }

  return users;
}

function ensureCommand(command) {
  try {
    execFileSync(command, ["--version"], { stdio: "ignore" });
  } catch (error) {
    throw new Error(`No se encontró el comando requerido en PATH: ${command}`);
  }
}

function applySqlFile(dbUrl, filePath) {
  execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", filePath], {
    stdio: "inherit",
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  ensureCommand("supabase");
  ensureCommand("psql");

  const remoteEnv = readEnvFile(options.remoteEnv);
  const localEnv = readEnvFile(options.localEnv);

  const remoteUrl = remoteEnv.SUPABASE_URL;
  const remoteServiceKey = remoteEnv.SUPABASE_SERVICE_ROLE_KEY;
  const localDbUrl = localEnv.DB_URL;

  if (!remoteUrl || !remoteServiceKey) {
    throw new Error(`Faltan SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY en ${options.remoteEnv}`);
  }

  if (!localDbUrl) {
    throw new Error(`Falta DB_URL en ${options.localEnv}`);
  }

  const projectRef = getProjectRefFromUrl(remoteUrl);
  if (!projectRef) {
    throw new Error(`No se pudo resolver el project ref desde ${remoteUrl}`);
  }

  fs.mkdirSync(options.outDir, { recursive: true });

  console.log(`Resolviendo schema remoto de ${projectRef}...`);
  const typesSource = runSupabaseGenTypes(projectRef);
  const typesPath = path.join(options.outDir, `${projectRef}.public.types.ts`);
  fs.writeFileSync(typesPath, typesSource, "utf8");

  const remoteTables = parseRemoteSchema(typesSource);
  const orderedTables = topologicalSortTables(remoteTables);

  const metadata = {
    projectRef,
    remoteEnv: options.remoteEnv,
  };

  const schemaSqlPath = path.join(options.outDir, `${projectRef}.public.schema.sql`);
  const schemaSql = buildSchemaSql(orderedTables, metadata);
  fs.writeFileSync(schemaSqlPath, schemaSql, "utf8");

  const remoteClient = createClient(remoteUrl, remoteServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let dataSqlPath = null;
  let authUsersPath = null;

  if (!options.schemaOnly) {
    console.log("Leyendo datos remotos de public...");
    const tableRows = new Map();
    for (const table of orderedTables) {
      const rows = await fetchTableRows(remoteClient, table);
      tableRows.set(table.name, rows);
      console.log(` - ${table.name}: ${rows.length} filas`);
    }

    const dataSql = buildDataSql(orderedTables, tableRows, metadata);
    dataSqlPath = path.join(options.outDir, `${projectRef}.public.data.sql`);
    fs.writeFileSync(dataSqlPath, dataSql, "utf8");

    const authUsers = await exportRemoteAuthUsers(remoteClient);
    authUsersPath = path.join(options.outDir, `${projectRef}.auth.users.json`);
    fs.writeFileSync(authUsersPath, JSON.stringify(authUsers, null, 2), "utf8");
  }

  if (options.apply) {
    if (!options.dataOnly) {
      console.log("Aplicando schema en la BD local...");
      applySqlFile(localDbUrl, schemaSqlPath);
    }
    if (!options.schemaOnly && dataSqlPath) {
      console.log("Aplicando datos en la BD local...");
      applySqlFile(localDbUrl, dataSqlPath);
    }
  }

  console.log("");
  console.log("Clone remoto -> local listo.");
  console.log(` - Types:  ${typesPath}`);
  console.log(` - Schema: ${schemaSqlPath}`);
  if (dataSqlPath) {
    console.log(` - Data:   ${dataSqlPath}`);
  }
  if (authUsersPath) {
    console.log(` - Auth:   ${authUsersPath}`);
  }
  console.log(
    "Nota: se clona el schema y los datos de public. Las passwords reales de auth no se exportan; para entrar al backoffice local crea un admin local.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
