import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { EVENT_TZ } from "shared/datetime";
import { getEntryCutoff } from "shared/entryLimit";
import { requireStaffRole } from "shared/auth/requireStaff";
import { getClientIp, parseRateLimitEnv, rateLimit, rateLimitHeaders } from "shared/security/rateLimit";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_SCAN_PER_MIN = parseRateLimitEnv(process.env.RATE_LIMIT_SCAN_PER_MIN, 120);

type ScanResult =
  | "valid"
  | "duplicate"
  | "expired"
  | "inactive"
  | "invalid"
  | "not_found"
  | "exhausted";
type MatchType = "code" | "ticket" | "none";
type QrKind =
  | "table"
  | "ticket_early"
  | "ticket_all_night"
  | "ticket_general"
  | "promoter"
  | "courtesy"
  | "unknown";

type ReservationCommercialContext = {
  id: string;
  table_id: string | null;
  product_id: string | null;
  sale_origin: "table" | "ticket" | null;
  ticket_pricing_phase: "early_bird" | "all_night" | null;
  table_name: string | null;
  product_name: string | null;
};

function normalizePricingPhase(value: string | null | undefined): "early_bird" | "all_night" | null {
  if (value === "early_bird" || value === "all_night") return value;
  return null;
}

function normalizeSaleOrigin(value: string | null | undefined): "table" | "ticket" | null {
  if (value === "table" || value === "ticket") return value;
  return null;
}

function isMissingReservationCommercialColumnsError(error: any): boolean {
  if (!error) return false;
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  const hint = String(error?.hint || "");
  const haystack = `${message} ${details} ${hint}`.toLowerCase();
  return (
    haystack.includes("does not exist") &&
    (haystack.includes("sale_origin") || haystack.includes("ticket_pricing_phase"))
  );
}

function getQrKindLabel(kind: QrKind): string {
  switch (kind) {
    case "table":
      return "Mesa / Box";
    case "ticket_early":
      return "Entrada EARLY";
    case "ticket_all_night":
      return "Entrada ALL NIGHT";
    case "ticket_general":
      return "Entrada General";
    case "promoter":
      return "Entrada Promotor";
    case "courtesy":
      return "Entrada Cortesía";
    default:
      return "QR no clasificado";
  }
}

function resolveQrKind({
  codeType,
  ticketTableId,
  reservation,
}: {
  codeType: string | null;
  ticketTableId: string | null;
  reservation: ReservationCommercialContext | null;
}): QrKind {
  if (ticketTableId || reservation?.table_id || codeType === "table") {
    return "table";
  }

  if (reservation?.ticket_pricing_phase === "early_bird") {
    return "ticket_early";
  }
  if (reservation?.ticket_pricing_phase === "all_night") {
    return "ticket_all_night";
  }

  if (codeType === "general") return "ticket_general";
  if (codeType === "promoter") return "promoter";
  if (codeType === "courtesy") return "courtesy";
  return "unknown";
}

async function fetchReservationCommercialContext(
  supabase: any,
  reservationId: string
): Promise<ReservationCommercialContext | null> {
  let reservationData: any = null;
  let reservationError: any = null;

  const withCommercialQuery = applyNotDeleted(
    supabase
      .from("table_reservations")
      .select(
        "id,table_id,product_id,sale_origin,ticket_pricing_phase,table:tables(name),product:table_products(name)"
      )
      .eq("id", reservationId)
  );
  const commercialResult = await withCommercialQuery.maybeSingle();
  reservationData = commercialResult.data;
  reservationError = commercialResult.error;

  if (reservationError && isMissingReservationCommercialColumnsError(reservationError)) {
    const legacyQuery = applyNotDeleted(
      supabase
        .from("table_reservations")
        .select("id,table_id,product_id,table:tables(name),product:table_products(name)")
        .eq("id", reservationId)
    );
    const legacyResult = await legacyQuery.maybeSingle();
    reservationData = legacyResult.data;
    reservationError = legacyResult.error;
  }

  if (reservationError || !reservationData?.id) return null;

  const tableRel = Array.isArray((reservationData as any).table)
    ? (reservationData as any).table?.[0]
    : (reservationData as any).table;
  const productRel = Array.isArray((reservationData as any).product)
    ? (reservationData as any).product?.[0]
    : (reservationData as any).product;

  return {
    id: String((reservationData as any).id),
    table_id: typeof (reservationData as any).table_id === "string" ? (reservationData as any).table_id : null,
    product_id: typeof (reservationData as any).product_id === "string" ? (reservationData as any).product_id : null,
    sale_origin: normalizeSaleOrigin((reservationData as any).sale_origin ?? null),
    ticket_pricing_phase: normalizePricingPhase((reservationData as any).ticket_pricing_phase ?? null),
    table_name: typeof tableRel?.name === "string" ? tableRel.name : null,
    product_name: typeof productRel?.name === "string" ? productRel.name : null,
  };
}

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req, ["door", "admin", "superadmin"]);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  const limiter = rateLimit(req, {
    keyPrefix: "backoffice:scan",
    limit: RATE_LIMIT_SCAN_PER_MIN,
    windowMs: RATE_LIMIT_WINDOW_MS,
    getKey: () => {
      const ip = getClientIp(req);
      const staffId = guard.context?.staffId;
      return staffId ? `${ip}:${staffId}` : ip;
    },
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { success: false, error: "rate_limited", retryAfterMs: limiter.resetMs },
      { status: 429, headers: rateLimitHeaders(limiter) }
    );
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }

  const codeValue = typeof body?.code === "string" ? body.code.trim() : "";
  const event_id = typeof body?.event_id === "string" ? body.event_id.trim() : "";
  const raw_value = codeValue;

  if (!codeValue || !event_id) {
    return NextResponse.json({ success: false, error: "code y event_id son requeridos" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const nowLima = DateTime.fromJSDate(now).setZone(EVENT_TZ);

  const eventQuery = applyNotDeleted(
    supabase.from("events").select("id,starts_at,entry_limit").eq("id", event_id)
  );
  const { data: eventRow, error: eventError } = await eventQuery.maybeSingle();

  if (eventError) {
    return NextResponse.json({ success: false, error: eventError.message }, { status: 400 });
  }
  if (!eventRow) {
    return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
  }

  const entryCutoff = getEntryCutoff(eventRow.starts_at, eventRow.entry_limit);
  const entryCutoffIso = entryCutoff?.cutoff.toUTC().toISO() ?? null;
  const entryCutoffExceeded = entryCutoff ? nowLima > entryCutoff.cutoff : false;

  const codeQuery = applyNotDeleted(
    supabase
      .from("codes")
      .select("id,code,type,event_id,is_active,max_uses,uses,expires_at,table_reservation_id")
      .eq("event_id", event_id)
      .eq("code", codeValue)
  );
  const { data: codeRow, error: codeErr } = await codeQuery.maybeSingle();

  if (codeErr) {
    return NextResponse.json({ success: false, error: codeErr.message }, { status: 400 });
  }

  let result: ScanResult = "not_found";
  let code_id: string | null = null;
  let ticket_id: string | null = null;
  let code_type: string | null = null;
  let reservation_id: string | null = null;
  let ticket_table_id: string | null = null;
  let ticket_product_id: string | null = null;
  let person: { full_name: string | null; dni: string | null; email: string | null; phone: string | null } | null = null;
  let ticket_used = false;
  let match_type: MatchType = "none";
  let reason: string | null = null;
  let other_event: { id: string; name: string | null } | null = null;

  if (codeRow) {
    match_type = "code";
    code_id = codeRow.id;
    code_type = (codeRow.type || "").toLowerCase() || null;
    reservation_id = typeof (codeRow as any).table_reservation_id === "string" ? (codeRow as any).table_reservation_id : null;
    const expired = codeRow.expires_at ? new Date(codeRow.expires_at) < now : false;
    if (!codeRow.is_active) {
      result = "inactive";
    } else if (expired) {
      result = "expired";
    } else if (codeRow.max_uses !== null && codeRow.max_uses !== undefined && (codeRow.uses ?? 0) >= codeRow.max_uses) {
      result = "exhausted";
    } else {
      result = "valid";
      if ((codeRow.type || "").toLowerCase() === "general" && entryCutoffExceeded) {
        result = "expired";
        reason = "entry_cutoff";
      }
    }

    const ticketQuery = applyNotDeleted(
      supabase
        .from("tickets")
        .select("id,full_name,dni,email,phone,used,table_id,product_id,table_reservation_id")
        .eq("code_id", codeRow.id)
        .eq("event_id", event_id)
        .order("created_at", { ascending: false })
        .limit(1)
    );
    const { data: ticketData } = await ticketQuery.maybeSingle();
    if (ticketData) {
      ticket_id = (ticketData as any).id ?? null;
      ticket_used = Boolean((ticketData as any).used);
      reservation_id =
        reservation_id ||
        (typeof (ticketData as any).table_reservation_id === "string" ? (ticketData as any).table_reservation_id : null);
      ticket_table_id = typeof (ticketData as any).table_id === "string" ? (ticketData as any).table_id : null;
      ticket_product_id = typeof (ticketData as any).product_id === "string" ? (ticketData as any).product_id : null;
      person = {
        full_name: (ticketData as any).full_name ?? null,
        dni: (ticketData as any).dni ?? null,
        email: (ticketData as any).email ?? null,
        phone: (ticketData as any).phone ?? null,
      };
      if (ticket_used) {
        result = "duplicate";
        reason = null;
      }
    }
  }

  if (!codeRow) {
    const qrTicketQuery = applyNotDeleted(
      supabase
        .from("tickets")
        .select("id,code_id,full_name,dni,email,phone,used,table_id,product_id,table_reservation_id,code:codes(type)")
        .eq("qr_token", codeValue)
        .eq("event_id", event_id)
    );
    const { data: ticketRow } = await qrTicketQuery.maybeSingle();
    if (ticketRow) {
      const codeRel = Array.isArray((ticketRow as any).code) ? (ticketRow as any).code?.[0] : (ticketRow as any).code;
      const codeType = (codeRel?.type || "").toLowerCase();
      code_type = codeType || null;
      match_type = "ticket";
      ticket_id = ticketRow.id;
      code_id = ticketRow.code_id ?? null;
      ticket_used = Boolean((ticketRow as any).used);
      reservation_id = typeof (ticketRow as any).table_reservation_id === "string" ? (ticketRow as any).table_reservation_id : null;
      ticket_table_id = typeof (ticketRow as any).table_id === "string" ? (ticketRow as any).table_id : null;
      ticket_product_id = typeof (ticketRow as any).product_id === "string" ? (ticketRow as any).product_id : null;
      if (ticket_used) {
        result = "duplicate";
      } else if (codeType === "general" && entryCutoffExceeded) {
        result = "expired";
        reason = "entry_cutoff";
      } else {
        result = "valid";
      }
      person = {
        full_name: (ticketRow as any).full_name ?? null,
        dni: (ticketRow as any).dni ?? null,
        email: (ticketRow as any).email ?? null,
        phone: (ticketRow as any).phone ?? null,
      };
    }
  }

  if (!codeRow && match_type === "none") {
    const otherCodeQuery = applyNotDeleted(
      supabase
        .from("codes")
        .select("event_id,event:events(name)")
        .eq("code", codeValue)
        .neq("event_id", event_id)
    );
    const { data: otherCode } = await otherCodeQuery.maybeSingle();
    const otherTicketQuery = applyNotDeleted(
      supabase
        .from("tickets")
        .select("event_id,event:events(name)")
        .eq("qr_token", codeValue)
        .neq("event_id", event_id)
    );
    const { data: otherTicket } = await otherTicketQuery.maybeSingle();
    const otherSource: any = otherCode || otherTicket;
    if (otherSource?.event_id) {
      const eventRel = Array.isArray(otherSource.event) ? otherSource.event?.[0] : otherSource.event;
      other_event = {
        id: otherSource.event_id,
        name: eventRel?.name ?? null,
      };
      result = "invalid";
      reason = "event_mismatch";
    } else {
      result = "not_found";
      reason = "not_found";
    }
  }

  // Política: 1 ingreso por persona por evento.
  // Si el mismo DNI ya tiene otro ticket used=true para este evento,
  // el resultado se convierte en "duplicate" automáticamente.
  // El portero no decide — la pantalla roja lo dice todo.
  let person_already_entered = false;
  if (result === "valid" && person?.dni) {
    const { data: otherUsed } = await applyNotDeleted(
      supabase
        .from("tickets")
        .select("id")
        .eq("event_id", event_id)
        .eq("dni", person.dni)
        .eq("used", true)
        .neq("id", ticket_id ?? "")
        .limit(1)
    ).maybeSingle();
    if (otherUsed?.id) {
      person_already_entered = true;
      result = "duplicate";
      reason = "person_already_entered";
    }
  }

  const reservationContext = reservation_id
    ? await fetchReservationCommercialContext(supabase, reservation_id)
    : null;
  const qr_kind = resolveQrKind({
    codeType: code_type,
    ticketTableId: ticket_table_id,
    reservation: reservationContext,
  });
  const qr_kind_label = getQrKindLabel(qr_kind);

  await supabase.from("scan_logs").insert({
    event_id,
    code_id,
    ticket_id,
    raw_value,
    result,
    scanned_by_staff_id: guard.context?.staffId || null,
  });

  return NextResponse.json({
    success: true,
    result,
    reason,
    match_type,
    other_event,
    code_id,
    ticket_id,
    code_type,
    qr_kind,
    qr_kind_label,
    reservation_id: reservationContext?.id || reservation_id || null,
    table_name: reservationContext?.table_name || null,
    product_name: reservationContext?.product_name || null,
    ticket_pricing_phase: reservationContext?.ticket_pricing_phase || null,
    sale_origin: reservationContext?.sale_origin || null,
    table_id: reservationContext?.table_id || ticket_table_id || null,
    product_id: reservationContext?.product_id || ticket_product_id || null,
    uses: codeRow?.uses ?? 0,
    max_uses: codeRow?.max_uses ?? null,
    expired_at: reason === "entry_cutoff" ? entryCutoffIso : codeRow?.expires_at ?? null,
    person,
    ticket_used,
    person_already_entered,
  });
}
