import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ReportKind = "promoter_performance" | "event_attendance" | "event_sales";
type OrganizerRel = { id?: string; name?: string; slug?: string };
type EventRaw = {
  id: string;
  name: string;
  organizer_id: string | null;
  organizer?: OrganizerRel | OrganizerRel[] | null;
};
type NormalizedEvent = {
  id: string;
  name: string;
  organizer_id: string | null;
  organizer_name: string;
  organizer_slug: string;
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
    !["promoter_performance", "event_attendance", "event_sales"].includes(
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
      .select("id,name,organizer_id,organizer:organizers(id,name,slug)")
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
    const { data: codesData, error: codesError } = await codesQuery;
    if (codesError) {
      return NextResponse.json(
        { success: false, error: codesError.message },
        { status: 400 },
      );
    }

    const { data: scansData, error: scansError } = await fetchScanLogs(
      supabase,
      {
        select:
          "id,event_id,ticket_id,code_id,raw_value,result,created_at,code:codes(promoter_id),ticket:tickets(promoter_id)",
        allowedEventIds,
        fromIso,
        toIso,
        limit: 10000,
      },
    );
    if (scansError) {
      return NextResponse.json(
        { success: false, error: scansError.message },
        { status: 400 },
      );
    }

    const promoterIds = new Set<string>();
    const counters = new Map<
      string,
      {
        event_id: string;
        promoter_id: string;
        codes_generated: number;
        scans_confirmed: number;
      }
    >();
    const ensureCounter = (event_id: string, promoter_id: string) => {
      const key = `${event_id}:${promoter_id}`;
      if (!counters.has(key)) {
        counters.set(key, {
          event_id,
          promoter_id,
          codes_generated: 0,
          scans_confirmed: 0,
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

    for (const scan of scansData || []) {
      if (!isConfirmedScanLog(scan)) continue;
      const event_id = (scan as any)?.event_id as string | null;
      const codeRel = Array.isArray((scan as any)?.code)
        ? (scan as any)?.code?.[0]
        : (scan as any)?.code;
      const ticketRel = Array.isArray((scan as any)?.ticket)
        ? (scan as any)?.ticket?.[0]
        : (scan as any)?.ticket;
      const promoter_id = (codeRel?.promoter_id ||
        ticketRel?.promoter_id ||
        "") as string;
      if (!event_id || !promoter_id) continue;
      if (promoterId && promoter_id !== promoterId) continue;
      promoterIds.add(promoter_id);
      ensureCounter(event_id, promoter_id).scans_confirmed += 1;
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
        const attendanceRate =
          row.codes_generated > 0
            ? Number(
                ((row.scans_confirmed / row.codes_generated) * 100).toFixed(2),
              )
            : 0;
        return {
          organizer_id: event?.organizer_id || promoter?.organizer_id || "",
          organizer_name: event?.organizer_name || "",
          event_id: row.event_id,
          event_name: event?.name || "",
          promoter_id: row.promoter_id,
          promoter_code: promoter?.code || "",
          promoter_name: promoter?.name || "",
          codes_generated: row.codes_generated,
          scans_confirmed: row.scans_confirmed,
          attendance_rate_percent: attendanceRate,
        };
      })
      .sort((a, b) => {
        if (a.organizer_name !== b.organizer_name)
          return a.organizer_name.localeCompare(b.organizer_name);
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
          { key: "codes_generated", label: "Códigos generados" },
          { key: "scans_confirmed", label: "Escaneos válidos" },
          { key: "attendance_rate_percent", label: "% de asistencia" },
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

  if (report === "event_attendance") {
    const { data: scansData, error: scansError } = await fetchScanLogs(
      supabase,
      {
        select:
          "id,event_id,ticket_id,code_id,raw_value,result,created_at,code:codes(code,type,promoter_id),ticket:tickets(promoter_id)",
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

    const incrementCount = (
      counter: Map<string, number>,
      key: string,
      delta = 1,
    ) => {
      counter.set(key, (counter.get(key) || 0) + delta);
    };
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
        scans: number;
        admissionSet: Set<string>;
        ticketSet: Set<string>;
        codeSet: Set<string>;
        freeScans: number;
        freeAdmissionSet: Set<string>;
        firstScanAt: string | null;
        lastScanAt: string | null;
        freeFirstScanAt: string | null;
        freeLastScanAt: string | null;
        typeScans: Map<string, number>;
        promoterScans: Map<string, number>;
        promoterAdmissionSets: Map<string, Set<string>>;
        withPromoterAdmissionSet: Set<string>;
        withoutPromoterAdmissionSet: Set<string>;
        withoutPromoterScans: number;
        codeUsage: Map<string, number>;
      }
    >();
    const promoterIds = new Set<string>();
    for (const scan of scansData || []) {
      const event_id = (scan as any).event_id as string;
      if (!grouped.has(event_id)) {
        grouped.set(event_id, {
          scans: 0,
          admissionSet: new Set<string>(),
          ticketSet: new Set<string>(),
          codeSet: new Set<string>(),
          freeScans: 0,
          freeAdmissionSet: new Set<string>(),
          firstScanAt: null,
          lastScanAt: null,
          freeFirstScanAt: null,
          freeLastScanAt: null,
          typeScans: new Map<string, number>(),
          promoterScans: new Map<string, number>(),
          promoterAdmissionSets: new Map<string, Set<string>>(),
          withPromoterAdmissionSet: new Set<string>(),
          withoutPromoterAdmissionSet: new Set<string>(),
          withoutPromoterScans: 0,
          codeUsage: new Map<string, number>(),
        });
      }
      const row = grouped.get(event_id)!;
      if (!isConfirmedScanLog(scan)) continue;
      row.scans += 1;
      const ticketId = (scan as any).ticket_id as string | null;
      const codeId = (scan as any).code_id as string | null;
      const createdAt = (scan as any).created_at as string | null;
      const admissionKey = getAdmissionKey(scan);
      const codeRel = Array.isArray((scan as any)?.code)
        ? (scan as any)?.code?.[0]
        : (scan as any)?.code;
      const ticketRel = Array.isArray((scan as any)?.ticket)
        ? (scan as any)?.ticket?.[0]
        : (scan as any)?.ticket;
      const codeType = String(codeRel?.type || "").toLowerCase();
      const typeBucket = normalizeTypeBucket(codeType);
      const isFreeCode =
        typeBucket === "free" ||
        typeBucket === "courtesy" ||
        typeBucket === "promoter_legacy";
      incrementCount(row.typeScans, typeBucket, 1);

      if (admissionKey) row.admissionSet.add(admissionKey);
      if (ticketId) row.ticketSet.add(ticketId);
      if (codeId) row.codeSet.add(codeId);

      const codeValue = String(codeRel?.code || "").trim();
      if (codeValue) {
        incrementCount(row.codeUsage, codeValue, 1);
      }

      const promoterId = String(
        codeRel?.promoter_id || ticketRel?.promoter_id || "",
      ).trim();
      if (promoterId) {
        promoterIds.add(promoterId);
        incrementCount(row.promoterScans, promoterId, 1);
        if (admissionKey) {
          if (!row.promoterAdmissionSets.has(promoterId)) {
            row.promoterAdmissionSets.set(promoterId, new Set<string>());
          }
          row.promoterAdmissionSets.get(promoterId)!.add(admissionKey);
          row.withPromoterAdmissionSet.add(admissionKey);
        }
      } else {
        row.withoutPromoterScans += 1;
        if (admissionKey) {
          row.withoutPromoterAdmissionSet.add(admissionKey);
        }
      }

      if (createdAt) {
        if (!row.firstScanAt || createdAt < row.firstScanAt)
          row.firstScanAt = createdAt;
        if (!row.lastScanAt || createdAt > row.lastScanAt)
          row.lastScanAt = createdAt;
      }

      if (isFreeCode) {
        row.freeScans += 1;
        if (admissionKey) row.freeAdmissionSet.add(admissionKey);
        if (createdAt) {
          if (!row.freeFirstScanAt || createdAt < row.freeFirstScanAt)
            row.freeFirstScanAt = createdAt;
          if (!row.freeLastScanAt || createdAt > row.freeLastScanAt)
            row.freeLastScanAt = createdAt;
        }
      }
    }

    const promoterIdList = Array.from(promoterIds);
    const { data: promoterRows } =
      promoterIdList.length > 0
        ? await applyNotDeleted(
            supabase
              .from("promoters")
              .select("id,code,person:persons(first_name,last_name)")
              .in("id", promoterIdList),
          )
        : { data: [] as any[] };
    const promoterLabelMap = new Map<string, string>();
    for (const promoter of promoterRows || []) {
      const personRel = Array.isArray((promoter as any)?.person)
        ? (promoter as any)?.person?.[0]
        : (promoter as any)?.person;
      const fullName = [personRel?.first_name, personRel?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      const code = String((promoter as any)?.code || "").trim();
      const label =
        [code, fullName].filter(Boolean).join(" - ") ||
        String((promoter as any).id || "");
      promoterLabelMap.set(String((promoter as any).id), label);
    }

    const rows = Array.from(grouped.entries()).map(([event_id, metrics]) => {
      const event = eventById.get(event_id);
      const topPromoters = Array.from(metrics.promoterScans.entries())
        .map(([id, scans]) => {
          const attendees = metrics.promoterAdmissionSets.get(id)?.size || 0;
          const label = promoterLabelMap.get(id) || id;
          return { id, scans, attendees, label };
        })
        .sort((a, b) => {
          if (a.attendees !== b.attendees) return b.attendees - a.attendees;
          if (a.scans !== b.scans) return b.scans - a.scans;
          return a.label.localeCompare(b.label);
        })
        .slice(0, 5)
        .map(
          (row) => `${row.label} (${row.attendees} pers. / ${row.scans} esc.)`,
        )
        .join(" | ");
      const topCodes = Array.from(metrics.codeUsage.entries())
        .sort((a, b) => {
          if (a[1] !== b[1]) return b[1] - a[1];
          return a[0].localeCompare(b[0]);
        })
        .slice(0, 5)
        .map(([code, count]) => `${code} (${count})`)
        .join(" | ");

      return {
        organizer_id: event?.organizer_id || "",
        organizer_name: event?.organizer_name || "",
        event_id,
        event_name: event?.name || "",
        scans_confirmed: metrics.scans,
        unique_admissions_confirmed: metrics.admissionSet.size,
        unique_tickets_scanned: metrics.ticketSet.size,
        unique_codes_scanned: metrics.codeSet.size,
        escaneos_qr_general: metrics.typeScans.get("general") || 0,
        escaneos_qr_cortesia: metrics.typeScans.get("courtesy") || 0,
        escaneos_qr_mesa: metrics.typeScans.get("table") || 0,
        escaneos_qr_free: metrics.typeScans.get("free") || 0,
        escaneos_qr_promotor_legado:
          metrics.typeScans.get("promoter_legacy") || 0,
        escaneos_qr_sin_tipo: metrics.typeScans.get("unknown") || 0,
        promotores_activos: metrics.promoterScans.size,
        asistentes_unicos_con_promotor: metrics.withPromoterAdmissionSet.size,
        asistentes_unicos_sin_promotor:
          metrics.withoutPromoterAdmissionSet.size,
        escaneos_sin_promotor: metrics.withoutPromoterScans,
        top_promotores: topPromoters || "Sin promotor identificado",
        top_codigos_usados: topCodes || "Sin códigos identificables",
        free_qr_scans_confirmed: metrics.freeScans,
        free_qr_unique_tickets_scanned: metrics.freeAdmissionSet.size,
        first_scan_at_lima: formatLimaDateTime(metrics.firstScanAt),
        last_scan_at_lima: formatLimaDateTime(metrics.lastScanAt),
        free_qr_first_scan_at_lima: formatLimaDateTime(metrics.freeFirstScanAt),
        free_qr_last_scan_at_lima: formatLimaDateTime(metrics.freeLastScanAt),
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
          { key: "escaneos_qr_general", label: "Escaneos QR general" },
          { key: "escaneos_qr_cortesia", label: "Escaneos QR cortesía" },
          { key: "escaneos_qr_mesa", label: "Escaneos QR mesa" },
          { key: "escaneos_qr_free", label: "Escaneos QR free" },
          {
            key: "escaneos_qr_promotor_legado",
            label: "Escaneos QR promotor (legado)",
          },
          {
            key: "escaneos_qr_sin_tipo",
            label: "Escaneos QR sin tipo identificado",
          },
          {
            key: "promotores_activos",
            label: "Promotores activos con ingresos",
          },
          {
            key: "asistentes_unicos_con_promotor",
            label: "Asistentes únicos con promotor",
          },
          {
            key: "asistentes_unicos_sin_promotor",
            label: "Asistentes únicos sin promotor",
          },
          { key: "escaneos_sin_promotor", label: "Escaneos sin promotor" },
          {
            key: "top_promotores",
            label: "Top promotores (asistencia/escaneos)",
          },
          { key: "top_codigos_usados", label: "Top códigos usados" },
          {
            key: "free_qr_scans_confirmed",
            label: "Escaneos QR free/cortesía",
          },
          {
            key: "free_qr_unique_tickets_scanned",
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

  let paymentsQuery = supabase
    .from("payments")
    .select("id,event_id,status,amount,currency_code,paid_at,created_at")
    .in("event_id", allowedEventIds)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(15000);
  if (fromIso) paymentsQuery = paymentsQuery.gte("created_at", fromIso);
  if (toIso) paymentsQuery = paymentsQuery.lte("created_at", toIso);
  const { data: paymentsData, error: paymentsError } = await paymentsQuery;
  if (paymentsError) {
    return NextResponse.json(
      { success: false, error: paymentsError.message },
      { status: 400 },
    );
  }

  const salesMap = new Map<
    string,
    { paid_count: number; total_amount: number; currency: string }
  >();
  for (const payment of paymentsData || []) {
    const event_id = (payment as any)?.event_id as string;
    if (!event_id) continue;
    if (!salesMap.has(event_id)) {
      salesMap.set(event_id, {
        paid_count: 0,
        total_amount: 0,
        currency: ((payment as any)?.currency_code as string) || "PEN",
      });
    }
    const row = salesMap.get(event_id)!;
    row.paid_count += 1;
    row.total_amount += Number((payment as any)?.amount || 0);
  }

  const rows = Array.from(salesMap.entries()).map(([event_id, metrics]) => {
    const event = eventById.get(event_id);
    return {
      organizer_id: event?.organizer_id || "",
      organizer_name: event?.organizer_name || "",
      event_id,
      event_name: event?.name || "",
      paid_count: metrics.paid_count,
      total_amount_raw: metrics.total_amount,
      total_amount_pen_est: Number((metrics.total_amount / 100).toFixed(2)),
      currency: metrics.currency,
    };
  });

  if (format === "csv") {
    const csv = toCsvFromColumns(
      [
        { key: "organizer_name", label: "Organizador" },
        { key: "event_name", label: "Evento" },
        { key: "paid_count", label: "Pagos confirmados" },
        { key: "total_amount_pen_est", label: "Ventas (S/)" },
        { key: "currency", label: "Moneda" },
      ],
      rows as any,
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
