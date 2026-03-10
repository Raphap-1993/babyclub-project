#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function parseArgs(argv) {
  const parsed = {
    envPath: "",
    eventId: "",
    eventName: "",
    latestPast: false,
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
      continue;
    }
    if (arg === "--latest-past") {
      parsed.latestPast = true;
    }
  }

  if (!parsed.eventId && !parsed.eventName) {
    parsed.latestPast = true;
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
    path.join(cwd, "apps", "landing", ".env.local"),
    path.join(cwd, "apps", "backoffice", ".env.local"),
    path.join(cwd, ".env.local"),
    path.join(cwd, ".env"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (loadEnvFile(candidate)) {
      return candidate;
    }
  }

  return null;
}

function formatDate(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function safeCountMap() {
  return Object.create(null);
}

function increment(map, key, amount = 1) {
  map[key] = (map[key] || 0) + amount;
}

function sumObjectValues(input) {
  return Object.values(input || {}).reduce((acc, value) => acc + Number(value || 0), 0);
}

function categorizeTicket(ticket, code) {
  const codeType = String(code?.type || "").toLowerCase();
  const hasReservation = Boolean(ticket?.table_reservation_id || code?.table_reservation_id);
  const hasTable = Boolean(ticket?.table_id);
  const hasPromoter = Boolean(code?.promoter_id || ticket?.promoter_id);

  if (codeType === "general") return "general_registration";
  if (hasTable || codeType === "table") return "table_reservation";
  if (hasReservation) return "ticket_sale_reservation";
  if (hasPromoter) return "promo_courtesy";
  if (codeType === "courtesy") return "courtesy_misc";
  if (codeType === "promoter") return "promoter_legacy";
  if (!code && ticket?.promoter_id) return "promo_courtesy";
  if (!code) return "no_code";
  return codeType || "other";
}

function normalizeCodeTypeSummary(code) {
  const codeType = String(code?.type || "unknown").toLowerCase();
  const prefix = code?.table_reservation_id ? "reservation_" : "";
  return `${prefix}${codeType}`;
}

function buildScanSummary(scans, ticketsById, codesById) {
  const byResult = safeCountMap();
  const byResultAndCategory = Object.create(null);
  const distinctAdmissions = new Set();
  let validPrecheckLogs = 0;
  let validConfirmLogs = 0;

  for (const scan of scans) {
    const result = String(scan.result || "unknown").toLowerCase();
    const ticket = scan.ticket_id ? ticketsById.get(scan.ticket_id) || null : null;
    const code =
      scan.code_id
        ? codesById.get(scan.code_id) || null
        : ticket?.code_id
          ? codesById.get(ticket.code_id) || null
          : null;
    const category = categorizeTicket(ticket || {}, code);
    const admissionKey = scan.ticket_id
      ? `ticket:${scan.ticket_id}`
      : scan.code_id
        ? `code:${scan.code_id}`
        : `raw:${scan.raw_value}`;

    increment(byResult, result, 1);
    if (!byResultAndCategory[result]) {
      byResultAndCategory[result] = safeCountMap();
    }
    increment(byResultAndCategory[result], category, 1);

    if (result === "valid") {
      distinctAdmissions.add(admissionKey);
      const isConfirmLog =
        (scan.ticket_id && scan.raw_value === scan.ticket_id) ||
        (scan.code_id && scan.raw_value === scan.code_id);

      if (isConfirmLog) validConfirmLogs += 1;
      else validPrecheckLogs += 1;
    }
  }

  return {
    total_logs: scans.length,
    by_result: byResult,
    by_result_and_category: byResultAndCategory,
    valid_precheck_logs: validPrecheckLogs,
    valid_confirm_logs: validConfirmLogs,
    valid_distinct_admissions: distinctAdmissions.size,
    valid_log_to_admission_ratio:
      distinctAdmissions.size > 0
        ? Number(((byResult.valid || 0) / distinctAdmissions.size).toFixed(2))
        : 0,
  };
}

function buildReservationSummary(reservations) {
  const summary = {
    active_count: 0,
    deleted_count: 0,
    active_requested_tickets: 0,
    deleted_requested_tickets: 0,
    active_by_status: safeCountMap(),
    deleted_by_status: safeCountMap(),
    active_by_origin: safeCountMap(),
    deleted_by_origin: safeCountMap(),
  };

  for (const reservation of reservations) {
    const deleted = Boolean(reservation.deleted_at);
    const status = String(reservation.status || "unknown").toLowerCase();
    const origin = String(
      reservation.sale_origin || (reservation.table_id ? "table_legacy" : "ticket_legacy")
    ).toLowerCase();
    const quantity = Number(reservation.ticket_quantity || 0);

    if (deleted) {
      summary.deleted_count += 1;
      summary.deleted_requested_tickets += quantity;
      increment(summary.deleted_by_status, status, 1);
      increment(summary.deleted_by_origin, origin, 1);
    } else {
      summary.active_count += 1;
      summary.active_requested_tickets += quantity;
      increment(summary.active_by_status, status, 1);
      increment(summary.active_by_origin, origin, 1);
    }
  }

  return summary;
}

function buildCodeSummary(codes) {
  const summary = {
    total_not_deleted: 0,
    active_count: 0,
    inactive_count: 0,
    deleted_count: 0,
    active_by_type: safeCountMap(),
    inactive_by_type: safeCountMap(),
    deleted_by_type: safeCountMap(),
  };

  for (const code of codes) {
    const bucket = normalizeCodeTypeSummary(code);

    if (code.deleted_at) {
      summary.deleted_count += 1;
      increment(summary.deleted_by_type, bucket, 1);
      continue;
    }

    summary.total_not_deleted += 1;
    if (code.is_active === false) {
      summary.inactive_count += 1;
      increment(summary.inactive_by_type, bucket, 1);
    } else {
      summary.active_count += 1;
      increment(summary.active_by_type, bucket, 1);
    }
  }

  return summary;
}

function buildTicketSummary(tickets, codesById) {
  const activeTickets = tickets.filter((ticket) => !ticket.deleted_at && ticket.is_active !== false);
  const usedActiveTickets = activeTickets.filter((ticket) => ticket.used);
  const categorySummary = safeCountMap();
  const usedCategorySummary = safeCountMap();

  for (const ticket of activeTickets) {
    const code = ticket.code_id ? codesById.get(ticket.code_id) || null : null;
    const category = categorizeTicket(ticket, code);
    increment(categorySummary, category, 1);
    if (ticket.used) increment(usedCategorySummary, category, 1);
  }

  return {
    total: tickets.length,
    active: activeTickets.length,
    used_active: usedActiveTickets.length,
    active_by_category: categorySummary,
    used_active_by_category: usedCategorySummary,
  };
}

function printObject(title, value) {
  console.log(`${title}:`);
  console.log(JSON.stringify(value, null, 2));
  console.log("");
}

async function resolveEvent(supabase, args) {
  if (args.eventId) {
    const eventById = await supabase
      .from("events")
      .select("id,name,starts_at,capacity,sale_status,closed_at,is_active")
      .eq("id", args.eventId)
      .is("deleted_at", null)
      .maybeSingle();

    if (eventById.error) throw eventById.error;
    return eventById.data || null;
  }

  if (args.eventName) {
    const byName = await supabase
      .from("events")
      .select("id,name,starts_at,capacity,sale_status,closed_at,is_active")
      .ilike("name", `%${args.eventName}%`)
      .is("deleted_at", null)
      .order("starts_at", { ascending: false })
      .limit(10);

    if (byName.error) throw byName.error;
    const candidates = byName.data || [];
    if (candidates.length === 0) return null;

    const exact = candidates.find(
      (event) => String(event.name || "").trim().toLowerCase() === args.eventName.trim().toLowerCase()
    );
    return exact || candidates[0];
  }

  const latestPast = await supabase
    .from("events")
    .select("id,name,starts_at,capacity,sale_status,closed_at,is_active")
    .is("deleted_at", null)
    .lt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestPast.error) throw latestPast.error;
  return latestPast.data || null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envPath = resolveEnvFile(args.envPath);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const event = await resolveEvent(supabase, args);
  if (!event) {
    console.error("No se encontró el evento solicitado.");
    process.exit(1);
  }

  const [ticketsRes, codesRes, reservationsRes, scansRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("id,code_id,table_id,table_reservation_id,promoter_id,used,is_active,deleted_at")
      .eq("event_id", event.id),
    supabase
      .from("codes")
      .select("id,type,promoter_id,table_reservation_id,is_active,max_uses,uses,deleted_at")
      .eq("event_id", event.id),
    supabase
      .from("table_reservations")
      .select(
        "id,status,table_id,ticket_id,ticket_quantity,sale_origin,ticket_pricing_phase,promoter_id,deleted_at"
      )
      .eq("event_id", event.id),
    supabase
      .from("scan_logs")
      .select("id,result,ticket_id,code_id,raw_value,created_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false })
      .limit(20000),
  ]);

  const queryError =
    ticketsRes.error || codesRes.error || reservationsRes.error || scansRes.error;
  if (queryError) {
    throw queryError;
  }

  const tickets = ticketsRes.data || [];
  const codes = codesRes.data || [];
  const reservations = reservationsRes.data || [];
  const scans = scansRes.data || [];
  const codesById = new Map(codes.map((code) => [code.id, code]));
  const ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));

  const ticketSummary = buildTicketSummary(tickets, codesById);
  const codeSummary = buildCodeSummary(codes);
  const reservationSummary = buildReservationSummary(reservations);
  const scanSummary = buildScanSummary(scans, ticketsById, codesById);

  const capacity = Number(event.capacity || 0);
  const ticketOverCapacity = capacity > 0 ? ticketSummary.active - capacity : 0;
  const confirmedOverCapacity = capacity > 0 ? ticketSummary.used_active - capacity : 0;

  console.log("=== BabyClub Event Capacity Audit ===");
  console.log("");
  console.log(`Env file: ${envPath || "not found"}`);
  console.log(`Event: ${event.name}`);
  console.log(`Event ID: ${event.id}`);
  console.log(`Starts At (UTC): ${formatDate(event.starts_at)}`);
  console.log(`Capacity: ${capacity || "n/a"}`);
  console.log(`Sale Status: ${event.sale_status || "n/a"}`);
  console.log(`Closed At (UTC): ${formatDate(event.closed_at)}`);
  console.log(`Is Active: ${event.is_active === false ? "false" : "true"}`);
  console.log("");

  console.log("--- Headline Metrics ---");
  console.log(`Active tickets issued: ${ticketSummary.active}`);
  console.log(`Confirmed admissions (used tickets): ${ticketSummary.used_active}`);
  console.log(`Scan logs (all): ${scanSummary.total_logs}`);
  console.log(`Scan logs valid: ${scanSummary.by_result.valid || 0}`);
  console.log(`Valid precheck logs: ${scanSummary.valid_precheck_logs}`);
  console.log(`Valid confirm logs: ${scanSummary.valid_confirm_logs}`);
  console.log(`Valid distinct admissions: ${scanSummary.valid_distinct_admissions}`);
  console.log(`Valid log/admission ratio: ${scanSummary.valid_log_to_admission_ratio}`);
  console.log(
    `Issued vs capacity delta: ${capacity > 0 ? ticketOverCapacity : "n/a"}`
  );
  console.log(
    `Confirmed vs capacity delta: ${capacity > 0 ? confirmedOverCapacity : "n/a"}`
  );
  console.log("");

  printObject("Ticket summary", ticketSummary);
  printObject("Code summary", codeSummary);
  printObject("Reservation summary", reservationSummary);
  printObject("Scan summary", scanSummary);

  const totalActiveCategories = sumObjectValues(ticketSummary.active_by_category);
  const totalUsedCategories = sumObjectValues(ticketSummary.used_active_by_category);
  if (totalActiveCategories !== ticketSummary.active || totalUsedCategories !== ticketSummary.used_active) {
    console.log("WARNING: category totals do not match ticket totals exactly.");
  }
}

main().catch((error) => {
  console.error("Audit failed:", error?.message || error);
  process.exit(1);
});
