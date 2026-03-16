import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ReportKind =
  | "promoter_performance"
  | "event_attendance"
  | "free_qr_no_show";
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
  return ["courtesy", "free", "promoter"].includes(codeType);
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

  const fullName = normalizeTicketIdentityValue(ticket?.full_name).toLowerCase();
  if (fullName) return `name:${fullName}`;

  const ticketId = normalizeTicketIdentityValue(ticket?.id);
  return ticketId ? `ticket:${ticketId}` : "";
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
    !["promoter_performance", "event_attendance", "free_qr_no_show"].includes(
      report,
    )
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
      .select("id,name,organizer_id,starts_at,organizer:organizers(id,name,slug)")
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
      if (typeof (row as any)?.id === "string" && typeof (row as any)?.promoter_id === "string") {
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
            ? Number(
                ((row.qrs_entered / row.qrs_assigned) * 100).toFixed(2),
              )
            : 0;
        return {
          organizer_id: event?.organizer_id || promoter?.organizer_id || "",
          event_id: row.event_id,
          event_name: event?.name || "",
          promoter_id: row.promoter_id,
          promoter_code: promoter?.code || "",
          promoter_name: promoterName,
          qrs_assigned: row.qrs_assigned,
          qrs_entered: row.qrs_entered,
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
          { key: "event_name", label: "Evento" },
          { key: "promoter_code", label: "Código promotor" },
          { key: "promoter_name", label: "Promotor" },
          { key: "qrs_assigned", label: "QRs asignados" },
          { key: "qrs_entered", label: "Ingresaron" },
          { key: "attendance_rate_percent", label: "% de conversión" },
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

  if (report === "free_qr_no_show") {
    let ticketsQuery = applyNotDeleted(
      supabase
        .from("tickets")
        .select(
          "id,event_id,person_id,full_name,doc_type,document,dni,email,phone,used,is_active,created_at,code:codes(id,code,type,promoter_id)",
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
      const codeType = normalizeTicketIdentityValue(codeRel?.type).toLowerCase();
      if (!isFreeCodeType(codeType)) continue;
      if ((ticket as any)?.is_active === false) continue;

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
        Boolean(ticketCreatedAt && ticketCreatedAt > row.last_ticket_created_at);
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
          free_qr_assigned: row.free_qr_assigned,
          free_qr_attended: row.free_qr_attended,
          free_qr_no_show: row.free_qr_no_show,
          no_show_rate_percent: noShowRate,
          last_free_qr_event: row.last_free_qr_event,
          last_free_qr_status: row.last_free_qr_status,
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
          { key: "organizer_name", label: "Organizador" },
          { key: "full_name", label: "Cliente" },
          { key: "doc_type", label: "Tipo doc." },
          { key: "document", label: "Documento" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Teléfono" },
          { key: "free_qr_assigned", label: "QR free asignados" },
          { key: "free_qr_attended", label: "Asistió" },
          { key: "free_qr_no_show", label: "No asistió" },
          { key: "no_show_rate_percent", label: "% no-show" },
          { key: "last_free_qr_event", label: "Último evento free" },
          { key: "last_free_qr_status", label: "Estado último QR free" },
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

    const grouped = new Map<
      string,
      {
        admissionSet: Set<string>;
        typeAdmissions: Map<string, Set<string>>;
      }
    >();

    for (const scan of scansData || []) {
      const event_id = (scan as any).event_id as string;
      if (!grouped.has(event_id)) {
        grouped.set(event_id, {
          admissionSet: new Set<string>(),
          typeAdmissions: new Map<string, Set<string>>(),
        });
      }
      const row = grouped.get(event_id)!;
      if (!isConfirmedScanLog(scan)) continue;

      const admissionKey = getAdmissionKey(scan);
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

      const bucket =
        typeBucket === "table"
          ? "mesa"
          : typeBucket === "courtesy" || typeBucket === "free"
            ? "cortesia"
            : typeBucket === "general"
              ? "general"
              : hasPromoter
                ? "promotor"
                : "general";

      if (admissionKey) {
        row.admissionSet.add(admissionKey);
        if (!row.typeAdmissions.has(bucket)) {
          row.typeAdmissions.set(bucket, new Set<string>());
        }
        row.typeAdmissions.get(bucket)!.add(admissionKey);
      }
    }

    const rows = Array.from(grouped.entries()).map(([event_id, metrics]) => {
      const event = eventById.get(event_id);
      return {
        organizer_id: event?.organizer_id || "",
        event_id,
        event_name: event?.name || "",
        asistentes: metrics.admissionSet.size,
        via_general: metrics.typeAdmissions.get("general")?.size || 0,
        via_mesa: metrics.typeAdmissions.get("mesa")?.size || 0,
        via_promotor: metrics.typeAdmissions.get("promotor")?.size || 0,
        via_cortesia: metrics.typeAdmissions.get("cortesia")?.size || 0,
      };
    });

    if (format === "csv") {
      const csv = toCsvFromColumns(
        [
          { key: "event_name", label: "Evento" },
          { key: "asistentes", label: "Asistentes" },
          { key: "via_general", label: "Vía QR general" },
          { key: "via_mesa", label: "Vía QR mesa" },
          { key: "via_promotor", label: "Vía QR promotor" },
          { key: "via_cortesia", label: "Vía QR cortesía/free" },
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

  return NextResponse.json({ success: false, error: "report inválido" }, { status: 400 });
}
