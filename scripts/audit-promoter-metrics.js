#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function parseArgs(argv) {
  const parsed = {
    envPath: "",
    eventId: "",
    eventName: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--env") {
      parsed.envPath = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--event-id") {
      parsed.eventId = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--event-name") {
      parsed.eventName = argv[i + 1] || "";
      i += 1;
    }
  }

  return parsed;
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    const value = stripWrappingQuotes(match[2] || "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  return true;
}

function resolveEnvFile(explicitPath) {
  const cwd = process.cwd();
  const candidates = [
    explicitPath,
    path.join(cwd, "apps", "backoffice", ".env.local"),
    path.join(cwd, "apps", "landing", ".env.local"),
    path.join(cwd, ".env.local"),
    path.join(cwd, ".env"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (loadEnvFile(candidate)) return candidate;
  }

  return null;
}

function formatName(row) {
  const person = Array.isArray(row?.person) ? row.person[0] : row?.person;
  const full = [person?.first_name, person?.last_name].filter(Boolean).join(" ").trim();
  return full || row?.code || row?.id || "Sin nombre";
}

function isConfirmedScan(scan) {
  const rawValue = typeof scan?.raw_value === "string" ? scan.raw_value.trim() : "";
  const ticketId = typeof scan?.ticket_id === "string" ? scan.ticket_id.trim() : "";
  const codeId = typeof scan?.code_id === "string" ? scan.code_id.trim() : "";

  if (!rawValue) return false;
  if (ticketId) return rawValue === ticketId;
  if (codeId) return rawValue === codeId;
  return false;
}

function ensureMetric(map, promoterId, promoterMeta) {
  if (!map.has(promoterId)) {
    map.set(promoterId, {
      promoter_id: promoterId,
      promoter_code: promoterMeta?.code || "",
      promoter_name: promoterMeta?.name || promoterId,
      codes_total: 0,
      codes_active: 0,
      codes_inactive: 0,
      tickets_total: 0,
      tickets_active: 0,
      tickets_used: 0,
      scans_confirmed: 0,
      scan_precheck_valid_logs: 0,
    });
  }
  return map.get(promoterId);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envUsed = resolveEnvFile(args.envPath);
  if (!envUsed) {
    throw new Error("No se pudo cargar archivo .env");
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let eventQuery = supabase
    .from("events")
    .select("id,name,starts_at,organizer_id")
    .is("deleted_at", null)
    .order("starts_at", { ascending: false })
    .limit(1);

  if (args.eventId) {
    eventQuery = eventQuery.eq("id", args.eventId);
  } else if (args.eventName) {
    eventQuery = eventQuery.ilike("name", `%${args.eventName}%`);
  } else {
    throw new Error("Pasa --event-id o --event-name");
  }

  const { data: event, error: eventError } = await eventQuery.maybeSingle();
  if (eventError || !event) {
    throw new Error(eventError?.message || "Evento no encontrado");
  }

  const eventId = event.id;
  const [
    { data: codes, error: codesError },
    { data: tickets, error: ticketsError },
    { data: scans, error: scansError },
    { data: promoters, error: promotersError },
  ] = await Promise.all([
    supabase
      .from("codes")
      .select("id,event_id,promoter_id,type,is_active,deleted_at")
      .eq("event_id", eventId),
    supabase
      .from("tickets")
      .select("id,event_id,promoter_id,code_id,is_active,deleted_at,used")
      .eq("event_id", eventId),
    supabase
      .from("scan_logs")
      .select("id,event_id,ticket_id,code_id,raw_value,result")
      .eq("event_id", eventId)
      .eq("result", "valid")
      .limit(10000),
    supabase
      .from("promoters")
      .select("id,code,person:persons(first_name,last_name)")
      .limit(5000),
  ]);

  if (codesError || ticketsError || scansError || promotersError) {
    throw new Error(
      codesError?.message ||
        ticketsError?.message ||
        scansError?.message ||
        promotersError?.message ||
        "No se pudo cargar data",
    );
  }

  const promoterMap = new Map(
    (promoters || []).map((row) => [
      row.id,
      { name: formatName(row), code: row.code || "" },
    ]),
  );
  const codeMap = new Map((codes || []).map((row) => [row.id, row]));
  const ticketMap = new Map((tickets || []).map((row) => [row.id, row]));
  const metrics = new Map();

  for (const code of codes || []) {
    if (!code.promoter_id) continue;
    const metric = ensureMetric(metrics, code.promoter_id, promoterMap.get(code.promoter_id));
    metric.codes_total += 1;
    if (code.deleted_at) continue;
    if (code.is_active === false) metric.codes_inactive += 1;
    else metric.codes_active += 1;
  }

  for (const ticket of tickets || []) {
    const code = ticket.code_id ? codeMap.get(ticket.code_id) : null;
    const promoterId = ticket.promoter_id || code?.promoter_id || null;
    if (!promoterId) continue;
    const metric = ensureMetric(metrics, promoterId, promoterMap.get(promoterId));
    metric.tickets_total += 1;
    if (!ticket.deleted_at && ticket.is_active !== false) metric.tickets_active += 1;
    if (ticket.used) metric.tickets_used += 1;
  }

  for (const scan of scans || []) {
    const ticket = scan.ticket_id ? ticketMap.get(scan.ticket_id) : null;
    const code = scan.code_id
      ? codeMap.get(scan.code_id)
      : ticket?.code_id
        ? codeMap.get(ticket.code_id)
        : null;
    const promoterId = code?.promoter_id || ticket?.promoter_id || null;
    if (!promoterId) continue;
    const metric = ensureMetric(metrics, promoterId, promoterMap.get(promoterId));
    if (isConfirmedScan(scan)) metric.scans_confirmed += 1;
    else metric.scan_precheck_valid_logs += 1;
  }

  const rows = Array.from(metrics.values()).sort((a, b) => {
    if (b.tickets_active !== a.tickets_active) return b.tickets_active - a.tickets_active;
    if (b.scans_confirmed !== a.scans_confirmed) return b.scans_confirmed - a.scans_confirmed;
    return a.promoter_name.localeCompare(b.promoter_name, "es", { sensitivity: "base" });
  });

  const payload = {
    event: {
      id: event.id,
      name: event.name,
      starts_at: event.starts_at,
      organizer_id: event.organizer_id || null,
    },
    metric_definitions: {
      qrs_cortesias_report_legacy: "tickets_active",
      ingresos_confirmados: "tickets_used o scans_confirmed",
      lecturas_precheck: "scan_precheck_valid_logs",
      codigos_generados: "codes_total",
    },
    rows,
  };

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
