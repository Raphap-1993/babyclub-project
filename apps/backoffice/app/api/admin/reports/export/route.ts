import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ReportKind =
  | "promoter_performance"
  | "promoter_settlement"
  | "event_attendance"
  | "free_qr_no_show"
  | "event_sales";
type OrganizerRel = { id?: string; name?: string; slug?: string };
type EventRaw = {
  id: string;
  name: string;
  organizer_id: string | null;
  starts_at?: string | null;
  organizer?: OrganizerRel | OrganizerRel[] | null;
};
type NormalizedEvent = {
  id: string;
  name: string;
  organizer_id: string | null;
  organizer_name: string;
  organizer_slug: string;
  starts_at: string | null;
};

function isMissingDeletedAtColumnError(error: any, tableName: string) {
  if (!error) return false;
  const haystack =
    `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return (
    haystack.includes(`${tableName}.deleted_at`) ||
    haystack.includes("column deleted_at does not exist")
  );
}

function isMissingTableSchemaCacheError(error: any, tableName: string) {
  if (!error) return false;
  const haystack =
    `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return (
    (haystack.includes(`public.${tableName}`) &&
      haystack.includes("schema cache")) ||
    haystack.includes(`relation "${tableName}" does not exist`) ||
    haystack.includes(`relation "public.${tableName}" does not exist`)
  );
}

function isMissingPromoterLinkTraceColumnsError(error: any) {
  if (!error) return false;
  const haystack =
    `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return (
    haystack.includes("promoter_link_code_id") ||
    haystack.includes("promoter_link_code")
  );
}

async function fetchScanLogs(
  supabase: any,
  {
    select,
    allowedEventIds,
    fromIso,
    toIso,
    limit,
  }: {
    select: string;
    allowedEventIds: string[];
    fromIso: string;
    toIso: string;
    limit: number;
  },
) {
  let scansQuery = applyNotDeleted(
    supabase
      .from("scan_logs")
      .select(select)
      .in("event_id", allowedEventIds)
      .eq("result", "valid")
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  if (fromIso) scansQuery = scansQuery.gte("created_at", fromIso);
  if (toIso) scansQuery = scansQuery.lte("created_at", toIso);

  let { data, error } = await scansQuery;

  if (error && isMissingDeletedAtColumnError(error, "scan_logs")) {
    let legacyQuery = supabase
      .from("scan_logs")
      .select(select)
      .in("event_id", allowedEventIds)
      .eq("result", "valid")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (fromIso) legacyQuery = legacyQuery.gte("created_at", fromIso);
    if (toIso) legacyQuery = legacyQuery.lte("created_at", toIso);
    const legacyResult = await legacyQuery;
    data = legacyResult.data;
    error = legacyResult.error;
  }

  return { data, error };
}

function toStartIso(dateValue: string | null) {
  if (!dateValue) return "";
  const raw = `${dateValue}T00:00:00.000Z`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function toEndIso(dateValue: string | null) {
  if (!dateValue) return "";
  const raw = `${dateValue}T23:59:59.999Z`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

type CsvColumn = { key: string; label: string };

function toCsvFromColumns(
  columns: CsvColumn[],
  rows: Array<Record<string, unknown>>,
) {
  const headers = columns.map((column) => column.label);
  const body = rows.map((row) =>
    columns.map((column) => csvEscape(row[column.key])).join(","),
  );
  return [headers.join(","), ...body].join("\n");
}

function formatLimaDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function isConfirmedScanLog(scan: any) {
  const rawValue =
    typeof scan?.raw_value === "string" ? scan.raw_value.trim() : "";
  const ticketId =
    typeof scan?.ticket_id === "string" ? scan.ticket_id.trim() : "";
  const codeId = typeof scan?.code_id === "string" ? scan.code_id.trim() : "";

  if (!rawValue) return false;
  if (ticketId) return rawValue === ticketId;
  if (codeId) return rawValue === codeId;
  return false;
}

function getAdmissionKey(scan: any) {
  const ticketId =
    typeof scan?.ticket_id === "string" ? scan.ticket_id.trim() : "";
  if (ticketId) return `ticket:${ticketId}`;
  const codeId = typeof scan?.code_id === "string" ? scan.code_id.trim() : "";
  if (codeId) return `code:${codeId}`;
  return "";
}

function isFreeCodeType(codeType: string) {
  return (
    codeType === "general" ||
    codeType === "promoter_link" ||
    codeType === "courtesy" ||
    codeType === "free"
  );
}

function normalizeTicketIdentityValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildTicketPersonKey(ticket: any) {
  const personId = normalizeTicketIdentityValue(ticket?.person_id);
  if (personId) return `person:${personId}`;

  const docType = normalizeTicketIdentityValue(ticket?.doc_type).toLowerCase();
  const document = normalizeTicketIdentityValue(ticket?.document).toLowerCase();
  if (docType && document) return `doc:${docType}:${document}`;

  const dni = normalizeTicketIdentityValue(ticket?.dni).toLowerCase();
  if (dni) return `dni:${dni}`;

  const email = normalizeTicketIdentityValue(ticket?.email).toLowerCase();
  if (email) return `email:${email}`;

  const phone = normalizeTicketIdentityValue(ticket?.phone)
    .replace(/\s+/g, "")
    .toLowerCase();
  if (phone) return `phone:${phone}`;

  const fullName = normalizeTicketIdentityValue(
    ticket?.full_name,
  ).toLowerCase();
  if (fullName) return `name:${fullName}`;

  const ticketId = normalizeTicketIdentityValue(ticket?.id);
  return ticketId ? `ticket:${ticketId}` : "";
}

function readRel(row: any, key: string) {
  const rel = row?.[key];
  return Array.isArray(rel) ? rel[0] : rel;
}

function normalizeStatus(value: unknown) {
  return normalizeTicketIdentityValue(value).toLowerCase();
}

function isPaidPaymentStatus(status: string) {
  return status === "paid";
}

function isApprovedReservationStatus(status: string) {
  return status === "approved" || status === "confirmed" || status === "paid";
}

function toAmountCents(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric * 100);
}

function resolveAccessKind({
  ticket,
  code,
  reservation,
  paidPayment,
}: {
  ticket: any;
  code: any;
  reservation: any;
  paidPayment: any;
}) {
  const reservationOrigin = normalizeStatus(reservation?.sale_origin);
  const reservationStatus = normalizeStatus(reservation?.status);
  const codeType = normalizeStatus(code?.type);
  const hasPaidPayment = Boolean(paidPayment);
  const hasTicketPaymentStatus =
    normalizeStatus(ticket?.payment_status) === "paid";
  const reservationApproved = isApprovedReservationStatus(reservationStatus);
  const ticketTotalCents = toAmountCents(reservation?.ticket_total_amount);
  const hasPaidTicketReservation =
    reservationOrigin === "ticket" &&
    reservationApproved &&
    (ticketTotalCents > 0 || hasPaidPayment || hasTicketPaymentStatus);

  if (
    reservationOrigin === "ticket" ||
    hasPaidPayment ||
    hasTicketPaymentStatus
  ) {
    if (hasPaidPayment || hasTicketPaymentStatus) return "paid_ticket_online";
    if (hasPaidTicketReservation) return "paid_ticket_manual";
    return "paid_ticket_pending";
  }

  if (reservationOrigin === "table" || codeType === "table") {
    return reservationApproved ? "paid_table_guest" : "table_pending";
  }

  if (codeType === "promoter_link") return "promoter_link";
  if (codeType === "general") return "free_general";
  if (codeType === "courtesy") {
    return code?.promoter_id ? "courtesy_promoter" : "courtesy_direct";
  }
  if (codeType === "free") return "free_general";
  return "unknown_legacy";
}

function resolvePromoterAttribution({
  ticket,
  code,
  reservation,
}: {
  ticket: any;
  code: any;
  reservation: any;
}) {
  const ticketPromoterId = normalizeTicketIdentityValue(ticket?.promoter_id);
  if (ticketPromoterId) {
    return { promoter_id: ticketPromoterId, attribution_source: "ticket" };
  }
  const reservationPromoterId = normalizeTicketIdentityValue(
    reservation?.promoter_id,
  );
  if (reservationPromoterId) {
    return {
      promoter_id: reservationPromoterId,
      attribution_source: "reservation",
    };
  }
  const codePromoterId = normalizeTicketIdentityValue(code?.promoter_id);
  if (codePromoterId) {
    return { promoter_id: codePromoterId, attribution_source: "code" };
  }
  return { promoter_id: "", attribution_source: "direct" };
}

function resolvePromoterLinkTrace(reservation: any, code: any) {
  const codeType = normalizeStatus(code?.type);
  const promoterLinkCodeId =
    normalizeTicketIdentityValue(reservation?.promoter_link_code_id) ||
    (codeType === "promoter_link"
      ? normalizeTicketIdentityValue(code?.id)
      : "");
  const promoterLinkCode =
    normalizeTicketIdentityValue(reservation?.promoter_link_code) ||
    (codeType === "promoter_link"
      ? normalizeTicketIdentityValue(code?.code)
      : "");

  return {
    promoter_link_code_id: promoterLinkCodeId || null,
    promoter_link_code: promoterLinkCode || null,
  };
}

type SettlementCandidateItem = {
  source_type: "ticket" | "reservation";
  source_id: string;
  event_id: string;
  promoter_id: string;
  attendee_name: string;
  attendee_document: string;
  access_kind: string;
  reward_kind: "cash" | "drink" | "mixed";
  cash_amount_cents: number;
  drink_units: number;
  used_at: string | null;
  metadata: Record<string, unknown>;
};

const TICKET_COMMISSION_CENTS_BY_CODE: Record<string, number> = {
  early_bird_1: 300,
  early_bird_2: 500,
  all_night_1: 350,
  all_night_2: 600,
};

const FREE_QR_ATTENDED_COMMISSION_CENTS = 150;

function resolveTicketCommissionCents(reservation: any) {
  const code = normalizeStatus(reservation?.ticket_type_code);
  if (code && TICKET_COMMISSION_CENTS_BY_CODE[code] != null) {
    return TICKET_COMMISSION_CENTS_BY_CODE[code];
  }

  const label = normalizeStatus(reservation?.ticket_type_label).replace(
    /\s+/g,
    " ",
  );
  const quantity = Number(reservation?.ticket_quantity || 0);
  const totalAmount = Number(reservation?.ticket_total_amount || 0);

  if (label.includes("early") && quantity >= 2) return 500;
  if (label.includes("early") && quantity === 1) return 300;
  if (label.includes("all") && quantity >= 2) return 600;
  if (label.includes("all") && quantity === 1) return 350;

  if (totalAmount >= 35 && quantity >= 2) return 600;
  if (totalAmount >= 20 && quantity === 1) return 350;
  if (quantity >= 2) return 500;
  if (quantity === 1) return 300;
  return 0;
}

function resolveTicketCommissionRule(reservation: any) {
  const code = normalizeStatus(reservation?.ticket_type_code);
  if (code && TICKET_COMMISSION_CENTS_BY_CODE[code] != null) return code;
  const quantity = Number(reservation?.ticket_quantity || 0);
  const totalAmount = Number(reservation?.ticket_total_amount || 0);
  if (totalAmount >= 35 && quantity >= 2) return "inferred_all_night_2";
  if (totalAmount >= 20 && quantity === 1) return "inferred_all_night_1";
  if (quantity >= 2) return "inferred_early_bird_2";
  if (quantity === 1) return "inferred_early_bird_1";
  return "unresolved";
}

function buildAttendeeName(ticketOrReservation: any) {
  return normalizeTicketIdentityValue(ticketOrReservation?.full_name);
}

function buildAttendeeDocument(ticketOrReservation: any) {
  return (
    normalizeTicketIdentityValue(ticketOrReservation?.document) ||
    normalizeTicketIdentityValue(ticketOrReservation?.dni)
  );
}

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status },
    );
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: "Supabase config missing" },
      { status: 500 },
    );
  }

  const search = req.nextUrl.searchParams;
  const report =
    ((search.get("report") || "promoter_performance").trim() as ReportKind) ||
    "promoter_performance";
  const format = (search.get("format") || "json").trim().toLowerCase();
  const organizerId = (search.get("organizer_id") || "").trim();
  const eventId = (search.get("event_id") || "").trim();
  const promoterId = (search.get("promoter_id") || "").trim();
  const fromIso = toStartIso(search.get("from"));
  const toIso = toEndIso(search.get("to"));

  if (
    ![
      "promoter_performance",
      "promoter_settlement",
      "event_attendance",
      "free_qr_no_show",
      "event_sales",
    ].includes(report)
  ) {
    return NextResponse.json(
      { success: false, error: "report inválido" },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let eventsQuery = applyNotDeleted(
    supabase
      .from("events")
      .select(
        "id,name,organizer_id,starts_at,organizer:organizers(id,name,slug)",
      )
      .order("starts_at", { ascending: true })
      .limit(2000),
  );
  if (organizerId) {
    eventsQuery = eventsQuery.eq("organizer_id", organizerId);
  }
  if (eventId) {
    eventsQuery = eventsQuery.eq("id", eventId);
  }
  const { data: events, error: eventsError } = await eventsQuery;
  if (eventsError) {
    return NextResponse.json(
      { success: false, error: eventsError.message },
      { status: 400 },
    );
  }

  const normalizedEvents: NormalizedEvent[] = (
    (events || []) as EventRaw[]
  ).map((event) => {
    const organizerRel = Array.isArray(event.organizer)
      ? event.organizer[0]
      : event.organizer;
    return {
      id: event.id,
      name: event.name,
      organizer_id: event.organizer_id,
      organizer_name: organizerRel?.name || "",
      organizer_slug: organizerRel?.slug || "",
      starts_at: event.starts_at || null,
    };
  });
  const allowedEventIds = normalizedEvents.map((event) => event.id);
  if (allowedEventIds.length === 0) {
    return NextResponse.json({ success: true, report, rows: [] });
  }

  const eventById = new Map<string, NormalizedEvent>(
    normalizedEvents.map((event): [string, NormalizedEvent] => [
      event.id,
      event,
    ]),
  );

  if (report === "promoter_performance") {
    let codesQuery = applyNotDeleted(
      supabase
        .from("codes")
        .select("id,event_id,promoter_id,created_at")
        .in("event_id", allowedEventIds)
        .order("created_at", { ascending: false })
        .limit(10000),
    );
    if (fromIso) codesQuery = codesQuery.gte("created_at", fromIso);
    if (toIso) codesQuery = codesQuery.lte("created_at", toIso);
    let ticketsQuery = applyNotDeleted(
      supabase
        .from("tickets")
        .select("id,event_id,promoter_id,code_id,is_active,used,created_at")
        .in("event_id", allowedEventIds)
        .order("created_at", { ascending: false })
        .limit(10000),
    );
    if (fromIso) ticketsQuery = ticketsQuery.gte("created_at", fromIso);
    if (toIso) ticketsQuery = ticketsQuery.lte("created_at", toIso);

    const [
      { data: codesData, error: codesError },
      { data: ticketsData, error: ticketsError },
    ] = await Promise.all([codesQuery, ticketsQuery]);

    if (codesError || ticketsError) {
      return NextResponse.json(
        { success: false, error: codesError?.message || ticketsError?.message },
        { status: 400 },
      );
    }

    const codeIdsForTickets = Array.from(
      new Set(
        ((ticketsData || []) as any[])
          .map((row) => (typeof row?.code_id === "string" ? row.code_id : ""))
          .filter(Boolean),
      ),
    );
    const { data: codePromoterRows, error: codePromoterError } =
      codeIdsForTickets.length > 0
        ? await supabase
            .from("codes")
            .select("id,promoter_id")
            .in("id", codeIdsForTickets)
        : { data: [] as any[], error: null };
    if (codePromoterError) {
      return NextResponse.json(
        { success: false, error: codePromoterError.message },
        { status: 400 },
      );
    }

    const codePromoterMap = new Map<string, string>();
    for (const row of codePromoterRows || []) {
      if (
        typeof (row as any)?.id === "string" &&
        typeof (row as any)?.promoter_id === "string"
      ) {
        codePromoterMap.set((row as any).id, (row as any).promoter_id);
      }
    }

    const promoterIds = new Set<string>();
    const counters = new Map<
      string,
      {
        event_id: string;
        promoter_id: string;
        codes_generated: number;
        qrs_assigned: number;
        qrs_entered: number;
      }
    >();
    const ensureCounter = (event_id: string, promoter_id: string) => {
      const key = `${event_id}:${promoter_id}`;
      if (!counters.has(key)) {
        counters.set(key, {
          event_id,
          promoter_id,
          codes_generated: 0,
          qrs_assigned: 0,
          qrs_entered: 0,
        });
      }
      return counters.get(key)!;
    };

    for (const row of codesData || []) {
      const promoter_id = (row as any)?.promoter_id as string | null;
      const event_id = (row as any)?.event_id as string | null;
      if (!event_id || !promoter_id) continue;
      if (promoterId && promoter_id !== promoterId) continue;
      promoterIds.add(promoter_id);
      ensureCounter(event_id, promoter_id).codes_generated += 1;
    }

    for (const ticket of ticketsData || []) {
      const event_id = (ticket as any)?.event_id as string | null;
      const directPromoterId =
        typeof (ticket as any)?.promoter_id === "string"
          ? (ticket as any).promoter_id
          : "";
      const codePromoterId =
        typeof (ticket as any)?.code_id === "string"
          ? codePromoterMap.get((ticket as any).code_id) || ""
          : "";
      const promoter_id = directPromoterId || codePromoterId;
      if (!event_id || !promoter_id) continue;
      if (promoterId && promoter_id !== promoterId) continue;
      promoterIds.add(promoter_id);
      const counter = ensureCounter(event_id, promoter_id);
      if ((ticket as any)?.is_active !== false) {
        counter.qrs_assigned += 1;
      }
      if ((ticket as any)?.used === true) {
        counter.qrs_entered += 1;
      }
    }

    const promoterIdList = Array.from(promoterIds);
    const { data: promoterRows } =
      promoterIdList.length > 0
        ? await applyNotDeleted(
            supabase
              .from("promoters")
              .select(
                "id,code,organizer_id,person:persons(first_name,last_name)",
              )
              .in("id", promoterIdList),
          )
        : { data: [] as any[] };
    const promoterMap = new Map<
      string,
      { code: string; name: string; organizer_id: string | null }
    >();
    for (const promoter of promoterRows || []) {
      const personRel = Array.isArray((promoter as any)?.person)
        ? (promoter as any)?.person?.[0]
        : (promoter as any)?.person;
      const name = [personRel?.first_name, personRel?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      promoterMap.set((promoter as any).id, {
        code: (promoter as any).code || "",
        name,
        organizer_id: (promoter as any).organizer_id || null,
      });
    }

    const rows = Array.from(counters.values())
      .map((row) => {
        const event = eventById.get(row.event_id);
        const promoter = promoterMap.get(row.promoter_id);
        const promoterName =
          promoter?.name ||
          promoter?.code ||
          `Promotor ${row.promoter_id.slice(0, 8)}`;
        const attendanceRate =
          row.qrs_assigned > 0
            ? Number(((row.qrs_entered / row.qrs_assigned) * 100).toFixed(2))
            : 0;
        return {
          organizer_id: event?.organizer_id || promoter?.organizer_id || "",
          organizer_name: event?.organizer_name || "",
          event_id: row.event_id,
          event_name: event?.name || "",
          promoter_id: row.promoter_id,
          promoter_code: promoter?.code || "",
          promoter_name: promoterName,
          qrs_assigned: row.qrs_assigned,
          qrs_entered: row.qrs_entered,
          codes_generated: row.codes_generated,
          attendance_rate_percent: attendanceRate,
        };
      })
      .sort((a, b) => {
        if (a.event_name !== b.event_name)
          return a.event_name.localeCompare(b.event_name);
        return a.promoter_name.localeCompare(b.promoter_name);
      });

    if (format === "csv") {
      const csv = toCsvFromColumns(
        [
          { key: "organizer_name", label: "Organizador" },
          { key: "event_name", label: "Evento" },
          { key: "promoter_code", label: "Código promotor" },
          { key: "promoter_name", label: "Promotor" },
          { key: "qrs_assigned", label: "QRs asignados" },
          { key: "qrs_entered", label: "Ingresaron" },
          { key: "attendance_rate_percent", label: "% de conversión" },
          { key: "codes_generated", label: "Códigos generados (auditoría)" },
        ],
        rows as any,
      );
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="reporte-promotores.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, report, rows });
  }

  if (report === "promoter_settlement") {
    let ticketsQuery = applyNotDeleted(
      supabase
        .from("tickets")
        .select(
          "id,event_id,promoter_id,code_id,person_id,full_name,doc_type,document,dni,email,phone,used,used_at,is_active,payment_status,table_reservation_id,created_at,code:codes(id,code,type,promoter_id,table_reservation_id)",
        )
        .in("event_id", allowedEventIds)
        .order("created_at", { ascending: false })
        .limit(20000),
    );
    if (fromIso) ticketsQuery = ticketsQuery.gte("created_at", fromIso);
    if (toIso) ticketsQuery = ticketsQuery.lte("created_at", toIso);

    const { data: ticketsData, error: ticketsError } = await ticketsQuery;
    if (ticketsError) {
      return NextResponse.json(
        { success: false, error: ticketsError.message },
        { status: 400 },
      );
    }

    let reservationQuery = applyNotDeleted(
      supabase
        .from("table_reservations")
        .select(
          "id,event_id,status,sale_origin,ticket_total_amount,ticket_quantity,ticket_type_code,ticket_type_label,ticket_unit_price,promoter_id,promoter_link_code_id,promoter_link_code,full_name,document,email,phone,created_at",
        )
        .in("event_id", allowedEventIds)
        .order("created_at", { ascending: false })
        .limit(20000),
    );
    let { data: reservationRows, error: reservationError } =
      await reservationQuery;
    if (
      reservationError &&
      isMissingPromoterLinkTraceColumnsError(reservationError)
    ) {
      reservationQuery = applyNotDeleted(
        supabase
          .from("table_reservations")
          .select(
            "id,event_id,status,sale_origin,ticket_total_amount,ticket_quantity,ticket_type_code,ticket_type_label,ticket_unit_price,promoter_id,full_name,document,email,phone,created_at",
          )
          .in("event_id", allowedEventIds)
          .order("created_at", { ascending: false })
          .limit(20000),
      );
      const legacyReservationResult = await reservationQuery;
      reservationRows = legacyReservationResult.data;
      reservationError = legacyReservationResult.error;
    }
    if (reservationError) {
      return NextResponse.json(
        { success: false, error: reservationError.message },
        { status: 400 },
      );
    }

    const reservationMap = new Map<string, any>();
    for (const reservation of reservationRows || []) {
      const id = normalizeTicketIdentityValue((reservation as any)?.id);
      if (id) reservationMap.set(id, reservation);
    }

    let paymentsData: any[] = [];
    let paymentsQuery = supabase
      .from("payments")
      .select(
        "id,event_id,reservation_id,ticket_id,status,amount,currency_code,paid_at,created_at",
      )
      .in("event_id", allowedEventIds)
      .order("created_at", { ascending: false })
      .limit(20000);
    if (fromIso) paymentsQuery = paymentsQuery.gte("created_at", fromIso);
    if (toIso) paymentsQuery = paymentsQuery.lte("created_at", toIso);

    const { data: paymentRows, error: paymentsError } = await paymentsQuery;
    if (
      paymentsError &&
      !isMissingTableSchemaCacheError(paymentsError, "payments")
    ) {
      return NextResponse.json(
        { success: false, error: paymentsError.message },
        { status: 400 },
      );
    }
    if (!paymentsError) paymentsData = paymentRows || [];

    const paidPaymentByTicket = new Map<string, any>();
    const paidPaymentByReservation = new Map<string, any>();
    for (const payment of paymentsData) {
      if (!isPaidPaymentStatus(normalizeStatus(payment?.status))) continue;
      const ticketId = normalizeTicketIdentityValue(payment?.ticket_id);
      const reservationId = normalizeTicketIdentityValue(
        payment?.reservation_id,
      );
      if (ticketId) paidPaymentByTicket.set(ticketId, payment);
      if (reservationId) paidPaymentByReservation.set(reservationId, payment);
    }

    const promoterIds = new Set<string>();
    const counters = new Map<
      string,
      {
        event_id: string;
        promoter_id: string;
        qrs_assigned: number;
        qrs_attended: number;
        no_show_count: number;
        paid_ticket_issued: number;
        paid_ticket_paid: number;
        paid_ticket_attended: number;
        free_issued: number;
        free_attended: number;
        free_no_show: number;
        courtesy_issued: number;
        courtesy_attended: number;
        courtesy_no_show: number;
        table_guest_issued: number;
        table_guest_attended: number;
        ticket_commission_count: number;
        free_commission_count: number;
        table_commission_count: number;
        eligible_cash_count: number;
        eligible_drink_count: number;
        settlement_items: SettlementCandidateItem[];
        unknown_legacy_count: number;
        data_quality_flags: Set<string>;
      }
    >();
    const ensureCounter = (event_id: string, promoter_id: string) => {
      const key = `${event_id}:${promoter_id}`;
      if (!counters.has(key)) {
        counters.set(key, {
          event_id,
          promoter_id,
          qrs_assigned: 0,
          qrs_attended: 0,
          no_show_count: 0,
          paid_ticket_issued: 0,
          paid_ticket_paid: 0,
          paid_ticket_attended: 0,
          free_issued: 0,
          free_attended: 0,
          free_no_show: 0,
          courtesy_issued: 0,
          courtesy_attended: 0,
          courtesy_no_show: 0,
          table_guest_issued: 0,
          table_guest_attended: 0,
          ticket_commission_count: 0,
          free_commission_count: 0,
          table_commission_count: 0,
          eligible_cash_count: 0,
          eligible_drink_count: 0,
          settlement_items: [],
          unknown_legacy_count: 0,
          data_quality_flags: new Set<string>(),
        });
      }
      return counters.get(key)!;
    };

    const commissionedReservationIds = new Set<string>();
    const commissionedTicketIds = new Set<string>();

    for (const ticket of ticketsData || []) {
      if ((ticket as any)?.is_active === false) continue;

      const event_id = normalizeTicketIdentityValue((ticket as any)?.event_id);
      const codeRel = readRel(ticket, "code");
      const reservationId = normalizeTicketIdentityValue(
        (ticket as any)?.table_reservation_id || codeRel?.table_reservation_id,
      );
      const reservation = reservationId
        ? reservationMap.get(reservationId)
        : null;
      const { promoter_id, attribution_source } = resolvePromoterAttribution({
        ticket,
        code: codeRel,
        reservation,
      });
      if (!event_id || !promoter_id) continue;
      if (promoterId && promoter_id !== promoterId) continue;

      promoterIds.add(promoter_id);
      const counter = ensureCounter(event_id, promoter_id);
      const ticketId = normalizeTicketIdentityValue((ticket as any)?.id);
      const paidPayment =
        (ticketId ? paidPaymentByTicket.get(ticketId) : null) ||
        (reservationId ? paidPaymentByReservation.get(reservationId) : null);
      const accessKind = resolveAccessKind({
        ticket,
        code: codeRel,
        reservation,
        paidPayment,
      });
      const promoterLinkTrace = resolvePromoterLinkTrace(reservation, codeRel);
      const used = (ticket as any)?.used === true;

      counter.qrs_assigned += 1;
      if (used) counter.qrs_attended += 1;
      else counter.no_show_count += 1;

      if (attribution_source === "reservation") {
        counter.data_quality_flags.add("promoter_from_reservation");
      }

      if (accessKind === "unknown_legacy") {
        counter.unknown_legacy_count += 1;
        counter.data_quality_flags.add("unknown_legacy");
      }

      if (accessKind === "paid_ticket_pending") {
        counter.paid_ticket_issued += 1;
        counter.data_quality_flags.add("paid_ticket_without_validated_payment");
      } else if (
        accessKind === "paid_ticket_online" ||
        accessKind === "paid_ticket_manual"
      ) {
        counter.paid_ticket_issued += 1;
        counter.paid_ticket_paid += 1;
        if (used) counter.paid_ticket_attended += 1;

        const sourceType = reservationId ? "reservation" : "ticket";
        const sourceId = reservationId || ticketId;
        const commissionKey = `${sourceType}:${sourceId}`;
        if (
          sourceId &&
          (sourceType === "reservation"
            ? !commissionedReservationIds.has(commissionKey)
            : !commissionedTicketIds.has(commissionKey))
        ) {
          if (sourceType === "reservation") {
            commissionedReservationIds.add(commissionKey);
          } else {
            commissionedTicketIds.add(commissionKey);
          }
          const cashAmountCents = resolveTicketCommissionCents(reservation);
          counter.eligible_cash_count += 1;
          counter.ticket_commission_count += 1;
          if (cashAmountCents <= 0) {
            counter.data_quality_flags.add("ticket_commission_without_rule");
          }
          counter.settlement_items.push({
            source_type: sourceType,
            source_id: sourceId,
            event_id,
            promoter_id,
            attendee_name:
              buildAttendeeName(reservation) || buildAttendeeName(ticket),
            attendee_document:
              buildAttendeeDocument(reservation) ||
              buildAttendeeDocument(ticket),
            access_kind: "paid_ticket",
            reward_kind: "cash",
            cash_amount_cents: cashAmountCents,
            drink_units: 0,
            used_at:
              normalizeTicketIdentityValue((ticket as any)?.used_at) || null,
            metadata: {
              ticket_id: ticketId,
              ticket_type_code:
                normalizeTicketIdentityValue(reservation?.ticket_type_code) ||
                null,
              ticket_type_label:
                normalizeTicketIdentityValue(reservation?.ticket_type_label) ||
                null,
              ticket_quantity: Number(reservation?.ticket_quantity || 0),
              ticket_total_amount: Number(
                reservation?.ticket_total_amount || 0,
              ),
              commission_rule: resolveTicketCommissionRule(reservation),
              commission_applies_without_attendance: true,
              ...promoterLinkTrace,
            },
          });
        }
      } else if (accessKind === "paid_table_guest") {
        counter.table_guest_issued += 1;
        if (used) counter.table_guest_attended += 1;
      } else if (accessKind === "table_pending") {
        counter.table_guest_issued += 1;
        counter.data_quality_flags.add("table_without_validated_payment");
      } else if (
        accessKind === "courtesy_promoter" ||
        accessKind === "courtesy_direct"
      ) {
        counter.courtesy_issued += 1;
        if (used) {
          counter.courtesy_attended += 1;
          counter.eligible_cash_count += 1;
          counter.free_commission_count += 1;
          if (ticketId) {
            counter.settlement_items.push({
              source_type: "ticket",
              source_id: ticketId,
              event_id,
              promoter_id,
              attendee_name: buildAttendeeName(ticket),
              attendee_document: buildAttendeeDocument(ticket),
              access_kind: accessKind,
              reward_kind: "cash",
              cash_amount_cents: FREE_QR_ATTENDED_COMMISSION_CENTS,
              drink_units: 0,
              used_at:
                normalizeTicketIdentityValue((ticket as any)?.used_at) || null,
              metadata: {
                code_id:
                  normalizeTicketIdentityValue((ticket as any)?.code_id) ||
                  null,
                commission_rule: "free_qr_attended",
                ...promoterLinkTrace,
              },
            });
          }
        } else {
          counter.courtesy_no_show += 1;
        }
      } else if (
        accessKind === "free_general" ||
        accessKind === "promoter_link"
      ) {
        counter.free_issued += 1;
        if (used) {
          counter.free_attended += 1;
          counter.eligible_cash_count += 1;
          counter.free_commission_count += 1;
          if (ticketId) {
            counter.settlement_items.push({
              source_type: "ticket",
              source_id: ticketId,
              event_id,
              promoter_id,
              attendee_name: buildAttendeeName(ticket),
              attendee_document: buildAttendeeDocument(ticket),
              access_kind: accessKind,
              reward_kind: "cash",
              cash_amount_cents: FREE_QR_ATTENDED_COMMISSION_CENTS,
              drink_units: 0,
              used_at:
                normalizeTicketIdentityValue((ticket as any)?.used_at) || null,
              metadata: {
                code_id:
                  normalizeTicketIdentityValue((ticket as any)?.code_id) ||
                  null,
                commission_rule: "free_qr_attended",
                ...promoterLinkTrace,
              },
            });
          }
        } else {
          counter.free_no_show += 1;
        }
      }
    }

    for (const reservation of reservationRows || []) {
      const reservationId = normalizeTicketIdentityValue(
        (reservation as any)?.id,
      );
      const event_id = normalizeTicketIdentityValue(
        (reservation as any)?.event_id,
      );
      const promoter_id = normalizeTicketIdentityValue(
        (reservation as any)?.promoter_id,
      );
      const saleOrigin = normalizeStatus((reservation as any)?.sale_origin);
      const status = normalizeStatus((reservation as any)?.status);
      if (!reservationId || !event_id || !promoter_id) continue;
      if (promoterId && promoter_id !== promoterId) continue;
      if (saleOrigin !== "table") continue;
      if (!isApprovedReservationStatus(status)) continue;

      const commissionKey = `reservation:${reservationId}`;
      if (commissionedReservationIds.has(commissionKey)) continue;
      commissionedReservationIds.add(commissionKey);

      promoterIds.add(promoter_id);
      const counter = ensureCounter(event_id, promoter_id);
      counter.eligible_cash_count += 1;
      counter.table_commission_count += 1;
      counter.data_quality_flags.add("table_commission_manual_amount");
      const promoterLinkTrace = resolvePromoterLinkTrace(reservation, null);
      counter.settlement_items.push({
        source_type: "reservation",
        source_id: reservationId,
        event_id,
        promoter_id,
        attendee_name: buildAttendeeName(reservation),
        attendee_document: buildAttendeeDocument(reservation),
        access_kind: "paid_table_reservation",
        reward_kind: "cash",
        cash_amount_cents: 0,
        drink_units: 0,
        used_at: null,
        metadata: {
          ticket_quantity: Number((reservation as any)?.ticket_quantity || 0),
          commission_rule: "table_manual_amount",
          commission_applies_to_table_reservation: true,
          ...promoterLinkTrace,
        },
      });
    }

    const promoterIdList = Array.from(promoterIds);
    const { data: promoterRows } =
      promoterIdList.length > 0
        ? await applyNotDeleted(
            supabase
              .from("promoters")
              .select(
                "id,code,organizer_id,person:persons(first_name,last_name)",
              )
              .in("id", promoterIdList),
          )
        : { data: [] as any[] };
    const promoterMap = new Map<
      string,
      { code: string; name: string; organizer_id: string | null }
    >();
    for (const promoter of promoterRows || []) {
      const personRel = readRel(promoter, "person");
      const name = [personRel?.first_name, personRel?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      promoterMap.set((promoter as any).id, {
        code: (promoter as any).code || "",
        name,
        organizer_id: (promoter as any).organizer_id || null,
      });
    }

    const candidateItems = Array.from(counters.values()).flatMap(
      (counter) => counter.settlement_items,
    );
    const candidateSourceIds = Array.from(
      new Set(candidateItems.map((item) => item.source_id).filter(Boolean)),
    );
    const settledSourceIds = new Set<string>();
    if (candidateSourceIds.length > 0) {
      const { data: settledRows, error: settledError } = await applyNotDeleted(
        supabase
          .from("promoter_settlement_items")
          .select("source_type,source_id")
          .in("source_id", candidateSourceIds)
          .limit(20000),
      );
      if (
        settledError &&
        !isMissingTableSchemaCacheError(
          settledError,
          "promoter_settlement_items",
        )
      ) {
        return NextResponse.json(
          { success: false, error: settledError.message },
          { status: 400 },
        );
      }
      if (!settledError) {
        for (const item of settledRows || []) {
          const sourceType = normalizeTicketIdentityValue(
            (item as any)?.source_type,
          );
          const sourceId = normalizeTicketIdentityValue(
            (item as any)?.source_id,
          );
          if (sourceType && sourceId) {
            settledSourceIds.add(`${sourceType}:${sourceId}`);
          }
        }
      }
    }

    const rows = Array.from(counters.values())
      .map((row) => {
        const event = eventById.get(row.event_id);
        const promoter = promoterMap.get(row.promoter_id);
        const promoterName =
          promoter?.name ||
          promoter?.code ||
          `Promotor ${row.promoter_id.slice(0, 8)}`;
        const attendanceRate =
          row.qrs_assigned > 0
            ? Number(((row.qrs_attended / row.qrs_assigned) * 100).toFixed(2))
            : 0;
        const settlementItems = row.settlement_items;
        const pendingSettlementItems = settlementItems.filter(
          (item) =>
            !settledSourceIds.has(`${item.source_type}:${item.source_id}`),
        );
        const commissionAmountCents = pendingSettlementItems.reduce(
          (total, item) => total + item.cash_amount_cents,
          0,
        );
        const promoterLinkCodes = Array.from(
          new Set(
            pendingSettlementItems
              .map((item) =>
                normalizeTicketIdentityValue(item.metadata?.promoter_link_code),
              )
              .filter(Boolean),
          ),
        )
          .sort()
          .join(" | ");
        const drinkUnits = pendingSettlementItems.reduce(
          (total, item) => total + item.drink_units,
          0,
        );
        const settledItemCount =
          settlementItems.length - pendingSettlementItems.length;
        return {
          metric_version: "promoter-settlement-v1",
          organizer_id: event?.organizer_id || promoter?.organizer_id || "",
          organizer_name: event?.organizer_name || "",
          event_id: row.event_id,
          event_name: event?.name || "",
          promoter_id: row.promoter_id,
          promoter_code: promoter?.code || "",
          promoter_name: promoterName,
          promoter_link_codes: promoterLinkCodes,
          qrs_assigned: row.qrs_assigned,
          qrs_attended: row.qrs_attended,
          no_show_count: row.no_show_count,
          attendance_rate_percent: attendanceRate,
          paid_ticket_issued: row.paid_ticket_issued,
          paid_ticket_paid: row.paid_ticket_paid,
          paid_ticket_attended: row.paid_ticket_attended,
          free_issued: row.free_issued,
          free_attended: row.free_attended,
          free_no_show: row.free_no_show,
          courtesy_issued: row.courtesy_issued,
          courtesy_attended: row.courtesy_attended,
          courtesy_no_show: row.courtesy_no_show,
          table_guest_issued: row.table_guest_issued,
          table_guest_attended: row.table_guest_attended,
          ticket_commission_count: row.ticket_commission_count,
          free_commission_count: row.free_commission_count,
          table_commission_count: row.table_commission_count,
          eligible_cash_count: row.eligible_cash_count,
          eligible_drink_count: row.eligible_drink_count,
          commission_amount_cents: commissionAmountCents,
          commission_amount_pen: Number(
            (commissionAmountCents / 100).toFixed(2),
          ),
          drink_units: drinkUnits,
          settlement_item_count: settlementItems.length,
          pending_settlement_item_count: pendingSettlementItems.length,
          settled_item_count: settledItemCount,
          settlement_items: pendingSettlementItems,
          unknown_legacy_count: row.unknown_legacy_count,
          data_quality_flags: Array.from(row.data_quality_flags)
            .sort()
            .join(" | "),
        };
      })
      .sort((a, b) => {
        if (a.event_name !== b.event_name)
          return a.event_name.localeCompare(b.event_name);
        return a.promoter_name.localeCompare(b.promoter_name);
      });

    if (format === "csv") {
      const csv = toCsvFromColumns(
        [
          { key: "organizer_name", label: "Organizador" },
          { key: "event_name", label: "Evento" },
          { key: "promoter_code", label: "Código promotor" },
          { key: "promoter_name", label: "Promotor" },
          { key: "promoter_link_codes", label: "Links usados" },
          { key: "qrs_assigned", label: "QRs asignados" },
          { key: "qrs_attended", label: "Ingresaron" },
          { key: "no_show_count", label: "No-show" },
          { key: "attendance_rate_percent", label: "% de conversión" },
          { key: "paid_ticket_issued", label: "Entradas pagadas emitidas" },
          { key: "paid_ticket_paid", label: "Entradas con pago validado" },
          {
            key: "paid_ticket_attended",
            label: "Entradas pagadas que ingresaron",
          },
          { key: "free_attended", label: "QR free que ingresaron" },
          { key: "courtesy_attended", label: "Cortesías que ingresaron" },
          {
            key: "table_guest_attended",
            label: "Invitados de mesa que ingresaron",
          },
          { key: "ticket_commission_count", label: "Compras con comisión" },
          { key: "free_commission_count", label: "QR free con comisión" },
          { key: "table_commission_count", label: "Mesas con comisión" },
          { key: "eligible_cash_count", label: "Comisiones pendientes" },
          { key: "commission_amount_pen", label: "Comisión estimada (S/)" },
          {
            key: "pending_settlement_item_count",
            label: "Items pendientes de liquidar",
          },
          { key: "settled_item_count", label: "Items ya liquidados" },
          { key: "data_quality_flags", label: "Alertas de datos" },
        ],
        rows as any,
      );
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="reporte-liquidacion-promotores.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, report, rows });
  }

  if (report === "free_qr_no_show") {
    let ticketsQuery = applyNotDeleted(
      supabase
        .from("tickets")
        .select(
          "id,event_id,person_id,full_name,doc_type,document,dni,email,phone,used,is_active,created_at,payment_status,table_reservation_id,code:codes(id,code,type,promoter_id,table_reservation_id)",
        )
        .in("event_id", allowedEventIds)
        .order("created_at", { ascending: false })
        .limit(15000),
    );
    if (fromIso) ticketsQuery = ticketsQuery.gte("created_at", fromIso);
    if (toIso) ticketsQuery = ticketsQuery.lte("created_at", toIso);

    const { data: ticketsData, error: ticketsError } = await ticketsQuery;
    if (ticketsError) {
      return NextResponse.json(
        { success: false, error: ticketsError.message },
        { status: 400 },
      );
    }

    const now = Date.now();
    const grouped = new Map<
      string,
      {
        organizer_id: string;
        organizer_name: string;
        full_name: string;
        doc_type: string;
        document: string;
        email: string;
        phone: string;
        free_qr_assigned: number;
        free_qr_attended: number;
        free_qr_no_show: number;
        last_free_qr_event: string;
        last_free_qr_status: string;
        last_free_qr_event_at: string | null;
        last_no_show_event: string;
        last_no_show_event_at: string | null;
        last_ticket_created_at: string | null;
      }
    >();

    const updateStringField = (currentValue: string, nextValue: string) =>
      currentValue || nextValue || "";

    for (const ticket of ticketsData || []) {
      const eventIdForTicket = normalizeTicketIdentityValue(
        (ticket as any)?.event_id,
      );
      if (!eventIdForTicket) continue;

      const event = eventById.get(eventIdForTicket);
      const eventStartsAt = event?.starts_at || null;
      if (eventStartsAt) {
        const startsAtMs = new Date(eventStartsAt).getTime();
        if (!Number.isNaN(startsAtMs) && startsAtMs > now) continue;
      }

      const codeRel = Array.isArray((ticket as any)?.code)
        ? (ticket as any)?.code?.[0]
        : (ticket as any)?.code;
      const codeType = normalizeTicketIdentityValue(
        codeRel?.type,
      ).toLowerCase();
      if (!isFreeCodeType(codeType)) continue;
      if ((ticket as any)?.is_active === false) continue;
      if ((ticket as any)?.payment_status) continue;
      if (
        normalizeTicketIdentityValue((ticket as any)?.table_reservation_id) ||
        normalizeTicketIdentityValue(codeRel?.table_reservation_id)
      ) {
        continue;
      }

      const organizerIdForTicket = event?.organizer_id || "";
      const personKey = buildTicketPersonKey(ticket);
      if (!personKey) continue;
      const aggregateKey = `${organizerIdForTicket}:${personKey}`;

      if (!grouped.has(aggregateKey)) {
        grouped.set(aggregateKey, {
          organizer_id: organizerIdForTicket,
          organizer_name: event?.organizer_name || "",
          full_name: "",
          doc_type: "",
          document: "",
          email: "",
          phone: "",
          free_qr_assigned: 0,
          free_qr_attended: 0,
          free_qr_no_show: 0,
          last_free_qr_event: "",
          last_free_qr_status: "",
          last_free_qr_event_at: null,
          last_no_show_event: "",
          last_no_show_event_at: null,
          last_ticket_created_at: null,
        });
      }

      const row = grouped.get(aggregateKey)!;
      const ticketCreatedAt =
        normalizeTicketIdentityValue((ticket as any)?.created_at) || null;
      const used = (ticket as any)?.used === true;

      row.organizer_name = updateStringField(
        row.organizer_name,
        event?.organizer_name || "",
      );
      row.full_name = updateStringField(
        row.full_name,
        normalizeTicketIdentityValue((ticket as any)?.full_name),
      );
      row.doc_type = updateStringField(
        row.doc_type,
        normalizeTicketIdentityValue((ticket as any)?.doc_type).toUpperCase(),
      );
      row.document = updateStringField(
        row.document,
        normalizeTicketIdentityValue((ticket as any)?.document) ||
          normalizeTicketIdentityValue((ticket as any)?.dni),
      );
      row.email = updateStringField(
        row.email,
        normalizeTicketIdentityValue((ticket as any)?.email),
      );
      row.phone = updateStringField(
        row.phone,
        normalizeTicketIdentityValue((ticket as any)?.phone),
      );
      row.free_qr_assigned += 1;
      if (used) {
        row.free_qr_attended += 1;
      } else {
        row.free_qr_no_show += 1;
      }

      const shouldReplaceLastTicket =
        !row.last_ticket_created_at ||
        Boolean(
          ticketCreatedAt && ticketCreatedAt > row.last_ticket_created_at,
        );
      if (shouldReplaceLastTicket) {
        row.last_ticket_created_at = ticketCreatedAt;
        row.last_free_qr_event = event?.name || "";
        row.last_free_qr_status = used ? "Asistió" : "No asistió";
        row.last_free_qr_event_at = eventStartsAt;
      }

      if (!used) {
        const shouldReplaceLastNoShow =
          !row.last_no_show_event_at ||
          Boolean(eventStartsAt && eventStartsAt > row.last_no_show_event_at);
        if (shouldReplaceLastNoShow) {
          row.last_no_show_event = event?.name || "";
          row.last_no_show_event_at = eventStartsAt;
        }
      }
    }

    const rows = Array.from(grouped.values())
      .map((row) => {
        const noShowRate =
          row.free_qr_assigned > 0
            ? Number(
                ((row.free_qr_no_show / row.free_qr_assigned) * 100).toFixed(2),
              )
            : 0;
        return {
          organizer_id: row.organizer_id,
          organizer_name: row.organizer_name,
          full_name: row.full_name,
          doc_type: row.doc_type,
          document: row.document,
          email: row.email,
          phone: row.phone,
          asistio: "NO",
          free_qr_assigned: row.free_qr_assigned,
          free_qr_attended: row.free_qr_attended,
          free_qr_no_show: row.free_qr_no_show,
          no_show_rate_percent: noShowRate,
          last_free_qr_event: row.last_free_qr_event,
          last_free_qr_status: row.last_free_qr_status,
          last_no_show_event: row.last_no_show_event,
          last_no_show_event_at: row.last_no_show_event_at,
          block_next_free_qr: row.free_qr_no_show > 0 ? "Sí" : "No",
        };
      })
      .filter((row) => row.free_qr_assigned > 0)
      .sort((a, b) => {
        if (a.free_qr_no_show !== b.free_qr_no_show) {
          return b.free_qr_no_show - a.free_qr_no_show;
        }
        if (a.no_show_rate_percent !== b.no_show_rate_percent) {
          return b.no_show_rate_percent - a.no_show_rate_percent;
        }
        return a.full_name.localeCompare(b.full_name);
      });

    if (format === "csv") {
      const csv = toCsvFromColumns(
        [
          { key: "full_name", label: "Cliente" },
          { key: "doc_type", label: "Tipo doc." },
          { key: "document", label: "Documento" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Teléfono" },
          { key: "asistio", label: "Asistió" },
          { key: "last_free_qr_event", label: "Evento" },
        ],
        rows as any,
      );
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="reporte-no-show-qr-free.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, report, rows });
  }

  if (report === "event_sales") {
    let paymentsQuery = supabase
      .from("payments")
      .select("id,event_id,status,amount,currency_code,created_at")
      .in("event_id", allowedEventIds)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(15000);
    if (fromIso) paymentsQuery = paymentsQuery.gte("created_at", fromIso);
    if (toIso) paymentsQuery = paymentsQuery.lte("created_at", toIso);

    const { data: paymentsData, error: paymentsError } = await paymentsQuery;

    let rows: Array<Record<string, unknown>> = [];

    if (
      paymentsError &&
      isMissingTableSchemaCacheError(paymentsError, "payments")
    ) {
      let reservationsQuery = applyNotDeleted(
        supabase
          .from("table_reservations")
          .select(
            "id,event_id,status,sale_origin,ticket_pricing_phase,ticket_quantity,created_at,product:table_products(price),table:tables(price,min_consumption)",
          )
          .in("event_id", allowedEventIds)
          .order("created_at", { ascending: false })
          .limit(15000),
      );
      if (fromIso)
        reservationsQuery = reservationsQuery.gte("created_at", fromIso);
      if (toIso) reservationsQuery = reservationsQuery.lte("created_at", toIso);

      const { data: reservationRows, error: reservationError } =
        await reservationsQuery;
      if (reservationError) {
        return NextResponse.json(
          { success: false, error: reservationError.message },
          { status: 400 },
        );
      }

      const grouped = new Map<string, { paid_count: number }>();
      for (const reservation of reservationRows || []) {
        const event_id = normalizeTicketIdentityValue(
          (reservation as any)?.event_id,
        );
        const status = normalizeTicketIdentityValue(
          (reservation as any)?.status,
        ).toLowerCase();
        if (!event_id || !["approved", "confirmed"].includes(status)) continue;
        grouped.set(event_id, {
          paid_count: (grouped.get(event_id)?.paid_count || 0) + 1,
        });
      }

      rows = Array.from(grouped.entries()).map(([event_id, metrics]) => {
        const event = eventById.get(event_id);
        return {
          organizer_id: event?.organizer_id || "",
          organizer_name: event?.organizer_name || "",
          event_id,
          event_name: event?.name || "",
          paid_count: metrics.paid_count,
          total_amount_raw: null,
          total_amount_pen_est: null,
          currency_code: "",
          sales_source: "reservations_fallback",
        };
      });
    } else if (paymentsError) {
      return NextResponse.json(
        { success: false, error: paymentsError.message },
        { status: 400 },
      );
    } else {
      const grouped = new Map<
        string,
        { paid_count: number; total_amount_raw: number; currency_code: string }
      >();
      for (const payment of paymentsData || []) {
        const event_id = normalizeTicketIdentityValue(
          (payment as any)?.event_id,
        );
        const status = normalizeTicketIdentityValue(
          (payment as any)?.status,
        ).toLowerCase();
        if (!event_id || status !== "paid") continue;
        const amount = Number((payment as any)?.amount);
        const current = grouped.get(event_id) || {
          paid_count: 0,
          total_amount_raw: 0,
          currency_code:
            normalizeTicketIdentityValue((payment as any)?.currency_code) ||
            "PEN",
        };
        current.paid_count += 1;
        if (Number.isFinite(amount)) current.total_amount_raw += amount;
        grouped.set(event_id, current);
      }

      rows = Array.from(grouped.entries()).map(([event_id, metrics]) => {
        const event = eventById.get(event_id);
        return {
          organizer_id: event?.organizer_id || "",
          organizer_name: event?.organizer_name || "",
          event_id,
          event_name: event?.name || "",
          paid_count: metrics.paid_count,
          total_amount_raw: metrics.total_amount_raw,
          total_amount_pen_est: Number(
            (metrics.total_amount_raw / 100).toFixed(2),
          ),
          currency_code: metrics.currency_code || "PEN",
          sales_source: "payments",
        };
      });
    }

    rows.sort((a, b) =>
      String(a.event_name || "").localeCompare(String(b.event_name || "")),
    );

    if (format === "csv") {
      const csv = toCsvFromColumns(
        [
          { key: "organizer_name", label: "Organizador" },
          { key: "event_name", label: "Evento" },
          { key: "paid_count", label: "Ventas confirmadas" },
          { key: "total_amount_pen_est", label: "Ventas (S/)" },
          { key: "currency_code", label: "Moneda" },
        ],
        rows,
      );
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="reporte-ventas-eventos.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, report, rows });
  }

  if (report === "event_attendance") {
    const { data: scansData, error: scansError } = await fetchScanLogs(
      supabase,
      {
        select:
          "id,event_id,ticket_id,code_id,raw_value,result,code:codes(type,promoter_id),ticket:tickets(promoter_id)",
        allowedEventIds,
        fromIso,
        toIso,
        limit: 15000,
      },
    );
    if (scansError) {
      return NextResponse.json(
        { success: false, error: scansError.message },
        { status: 400 },
      );
    }

    const normalizeTypeBucket = (codeType: string) => {
      if (codeType === "general") return "general";
      if (codeType === "courtesy") return "courtesy";
      if (codeType === "table") return "table";
      if (codeType === "free") return "free";
      if (codeType === "promoter") return "promoter_legacy";
      return "unknown";
    };

    const makeTypeCounts = () => ({
      general: 0,
      courtesy: 0,
      table: 0,
      free: 0,
      promoter_legacy: 0,
      unknown: 0,
    });

    const grouped = new Map<
      string,
      {
        scansConfirmed: number;
        admissionSet: Set<string>;
        ticketSet: Set<string>;
        codeSet: Set<string>;
        typeScans: ReturnType<typeof makeTypeCounts>;
        promotersWithEntries: Set<string>;
        attendeesWithPromoter: Set<string>;
        attendeesWithoutPromoter: Set<string>;
        scansWithoutPromoter: number;
        promoterCounts: Map<string, number>;
        codeCounts: Map<string, number>;
        firstScanAt: string | null;
        lastScanAt: string | null;
        freeQrScansConfirmed: number;
        freeQrTicketSet: Set<string>;
        freeQrPersonSet: Set<string>;
        freeQrFirstScanAt: string | null;
        freeQrLastScanAt: string | null;
      }
    >();

    const replaceFirst = (current: string | null, next: string | null) => {
      if (!next) return current;
      if (!current) return next;
      return next < current ? next : current;
    };
    const replaceLast = (current: string | null, next: string | null) => {
      if (!next) return current;
      if (!current) return next;
      return next > current ? next : current;
    };

    for (const scan of scansData || []) {
      const event_id = (scan as any).event_id as string;
      if (!grouped.has(event_id)) {
        grouped.set(event_id, {
          scansConfirmed: 0,
          admissionSet: new Set<string>(),
          ticketSet: new Set<string>(),
          codeSet: new Set<string>(),
          typeScans: makeTypeCounts(),
          promotersWithEntries: new Set<string>(),
          attendeesWithPromoter: new Set<string>(),
          attendeesWithoutPromoter: new Set<string>(),
          scansWithoutPromoter: 0,
          promoterCounts: new Map<string, number>(),
          codeCounts: new Map<string, number>(),
          firstScanAt: null,
          lastScanAt: null,
          freeQrScansConfirmed: 0,
          freeQrTicketSet: new Set<string>(),
          freeQrPersonSet: new Set<string>(),
          freeQrFirstScanAt: null,
          freeQrLastScanAt: null,
        });
      }
      const row = grouped.get(event_id)!;
      if (!isConfirmedScanLog(scan)) continue;

      const admissionKey = getAdmissionKey(scan);
      const ticketId = normalizeTicketIdentityValue((scan as any)?.ticket_id);
      const codeId = normalizeTicketIdentityValue((scan as any)?.code_id);
      const createdAt = normalizeTicketIdentityValue((scan as any)?.created_at);
      const codeRel = Array.isArray((scan as any)?.code)
        ? (scan as any)?.code?.[0]
        : (scan as any)?.code;
      const ticketRel = Array.isArray((scan as any)?.ticket)
        ? (scan as any)?.ticket?.[0]
        : (scan as any)?.ticket;
      const codeType = String(codeRel?.type || "").toLowerCase();
      const typeBucket = normalizeTypeBucket(codeType);
      const promoterId = String(
        codeRel?.promoter_id || ticketRel?.promoter_id || "",
      ).trim();
      const hasPromoter = Boolean(promoterId);

      row.scansConfirmed += 1;
      row.typeScans[typeBucket] += 1;
      row.firstScanAt = replaceFirst(row.firstScanAt, createdAt || null);
      row.lastScanAt = replaceLast(row.lastScanAt, createdAt || null);

      if (admissionKey) {
        row.admissionSet.add(admissionKey);
        if (hasPromoter) {
          row.attendeesWithPromoter.add(admissionKey);
        } else {
          row.attendeesWithoutPromoter.add(admissionKey);
        }
      }
      if (ticketId) row.ticketSet.add(ticketId);
      if (codeId) {
        row.codeSet.add(codeId);
        row.codeCounts.set(codeId, (row.codeCounts.get(codeId) || 0) + 1);
      }

      if (hasPromoter) {
        row.promotersWithEntries.add(promoterId);
        row.promoterCounts.set(
          promoterId,
          (row.promoterCounts.get(promoterId) || 0) + 1,
        );
      } else {
        row.scansWithoutPromoter += 1;
      }

      if (typeBucket === "courtesy" || typeBucket === "free") {
        row.freeQrScansConfirmed += 1;
        if (ticketId) row.freeQrTicketSet.add(ticketId);
        if (admissionKey) row.freeQrPersonSet.add(admissionKey);
        row.freeQrFirstScanAt = replaceFirst(
          row.freeQrFirstScanAt,
          createdAt || null,
        );
        row.freeQrLastScanAt = replaceLast(
          row.freeQrLastScanAt,
          createdAt || null,
        );
      }
    }

    const rows = Array.from(grouped.entries()).map(([event_id, metrics]) => {
      const event = eventById.get(event_id);
      return {
        organizer_id: event?.organizer_id || "",
        organizer_name: event?.organizer_name || "",
        event_id,
        event_name: event?.name || "",
        scans_confirmed: metrics.scansConfirmed,
        unique_admissions_confirmed: metrics.admissionSet.size,
        unique_tickets_scanned: metrics.ticketSet.size,
        unique_codes_scanned: metrics.codeSet.size,
        general_qr_scans_confirmed: metrics.typeScans.general,
        courtesy_qr_scans_confirmed: metrics.typeScans.courtesy,
        table_qr_scans_confirmed: metrics.typeScans.table,
        free_type_qr_scans_confirmed: metrics.typeScans.free,
        promoter_legacy_qr_scans_confirmed: metrics.typeScans.promoter_legacy,
        unknown_qr_scans_confirmed: metrics.typeScans.unknown,
        promoters_active_with_entries: metrics.promotersWithEntries.size,
        unique_attendees_with_promoter: metrics.attendeesWithPromoter.size,
        unique_attendees_without_promoter:
          metrics.attendeesWithoutPromoter.size,
        scans_without_promoter: metrics.scansWithoutPromoter,
        top_promoters: Array.from(metrics.promoterCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([id, count]) => `${id}:${count}`)
          .join(" | "),
        top_codes: Array.from(metrics.codeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([id, count]) => `${id}:${count}`)
          .join(" | "),
        free_qr_scans_confirmed: metrics.freeQrScansConfirmed,
        free_qr_unique_tickets_scanned: metrics.freeQrTicketSet.size,
        free_qr_unique_people_scanned: metrics.freeQrPersonSet.size,
        first_scan_at_lima: formatLimaDateTime(metrics.firstScanAt),
        last_scan_at_lima: formatLimaDateTime(metrics.lastScanAt),
        free_qr_first_scan_at_lima: formatLimaDateTime(
          metrics.freeQrFirstScanAt,
        ),
        free_qr_last_scan_at_lima: formatLimaDateTime(metrics.freeQrLastScanAt),
      };
    });

    if (format === "csv") {
      const csv = toCsvFromColumns(
        [
          { key: "organizer_name", label: "Organizador" },
          { key: "event_name", label: "Evento" },
          { key: "scans_confirmed", label: "Escaneos válidos" },
          {
            key: "unique_admissions_confirmed",
            label: "Admisiones únicas confirmadas",
          },
          { key: "unique_tickets_scanned", label: "Tickets únicos" },
          { key: "unique_codes_scanned", label: "Códigos únicos" },
          {
            key: "general_qr_scans_confirmed",
            label: "Escaneos QR general",
          },
          {
            key: "courtesy_qr_scans_confirmed",
            label: "Escaneos QR cortesía",
          },
          { key: "table_qr_scans_confirmed", label: "Escaneos QR mesa" },
          { key: "free_type_qr_scans_confirmed", label: "Escaneos QR free" },
          {
            key: "promoter_legacy_qr_scans_confirmed",
            label: "Escaneos QR promotor (legado)",
          },
          {
            key: "unknown_qr_scans_confirmed",
            label: "Escaneos QR sin tipo identificado",
          },
          {
            key: "promoters_active_with_entries",
            label: "Promotores activos con ingresos",
          },
          {
            key: "unique_attendees_with_promoter",
            label: "Asistentes únicos con promotor",
          },
          {
            key: "unique_attendees_without_promoter",
            label: "Asistentes únicos sin promotor",
          },
          { key: "scans_without_promoter", label: "Escaneos sin promotor" },
          {
            key: "top_promoters",
            label: "Top promotores (asistencia/escaneos)",
          },
          { key: "top_codes", label: "Top códigos usados" },
          {
            key: "free_qr_scans_confirmed",
            label: "Escaneos QR free/cortesía",
          },
          {
            key: "free_qr_unique_people_scanned",
            label: "Personas únicas QR free/cortesía",
          },
          { key: "first_scan_at_lima", label: "Primer ingreso (Lima)" },
          { key: "last_scan_at_lima", label: "Último ingreso (Lima)" },
          {
            key: "free_qr_first_scan_at_lima",
            label: "Primer ingreso QR free/cortesía (Lima)",
          },
          {
            key: "free_qr_last_scan_at_lima",
            label: "Último ingreso QR free/cortesía (Lima)",
          },
        ],
        rows as any,
      );
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="reporte-asistencia-eventos.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, report, rows });
  }

  return NextResponse.json(
    { success: false, error: "report inválido" },
    { status: 400 },
  );
}
