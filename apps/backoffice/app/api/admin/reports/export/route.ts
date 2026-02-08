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

function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const body = rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","));
  return [headers.join(","), ...body].join("\n");
}

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const search = req.nextUrl.searchParams;
  const report = ((search.get("report") || "promoter_performance").trim() as ReportKind) || "promoter_performance";
  const format = (search.get("format") || "json").trim().toLowerCase();
  const organizerId = (search.get("organizer_id") || "").trim();
  const eventId = (search.get("event_id") || "").trim();
  const promoterId = (search.get("promoter_id") || "").trim();
  const fromIso = toStartIso(search.get("from"));
  const toIso = toEndIso(search.get("to"));

  if (!["promoter_performance", "event_attendance", "event_sales"].includes(report)) {
    return NextResponse.json({ success: false, error: "report inválido" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let eventsQuery = applyNotDeleted(
    supabase
      .from("events")
      .select("id,name,organizer_id,organizer:organizers(id,name,slug)")
      .order("starts_at", { ascending: true })
      .limit(2000)
  );
  if (organizerId) {
    eventsQuery = eventsQuery.eq("organizer_id", organizerId);
  }
  if (eventId) {
    eventsQuery = eventsQuery.eq("id", eventId);
  }
  const { data: events, error: eventsError } = await eventsQuery;
  if (eventsError) {
    return NextResponse.json({ success: false, error: eventsError.message }, { status: 400 });
  }

  const normalizedEvents: NormalizedEvent[] = ((events || []) as EventRaw[]).map((event) => {
    const organizerRel = Array.isArray(event.organizer) ? event.organizer[0] : event.organizer;
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
    normalizedEvents.map((event): [string, NormalizedEvent] => [event.id, event])
  );

  if (report === "promoter_performance") {
    let codesQuery = applyNotDeleted(
      supabase
        .from("codes")
        .select("id,event_id,promoter_id,created_at")
        .in("event_id", allowedEventIds)
        .order("created_at", { ascending: false })
        .limit(10000)
    );
    if (fromIso) codesQuery = codesQuery.gte("created_at", fromIso);
    if (toIso) codesQuery = codesQuery.lte("created_at", toIso);
    const { data: codesData, error: codesError } = await codesQuery;
    if (codesError) {
      return NextResponse.json({ success: false, error: codesError.message }, { status: 400 });
    }

    let scansQuery = applyNotDeleted(
      supabase
        .from("scan_logs")
        .select("id,event_id,result,created_at,code:codes(promoter_id),ticket:tickets(promoter_id)")
        .in("event_id", allowedEventIds)
        .eq("result", "valid")
        .order("created_at", { ascending: false })
        .limit(10000)
    );
    if (fromIso) scansQuery = scansQuery.gte("created_at", fromIso);
    if (toIso) scansQuery = scansQuery.lte("created_at", toIso);
    const { data: scansData, error: scansError } = await scansQuery;
    if (scansError) {
      return NextResponse.json({ success: false, error: scansError.message }, { status: 400 });
    }

    const promoterIds = new Set<string>();
    const counters = new Map<string, { event_id: string; promoter_id: string; codes_generated: number; scans_confirmed: number }>();
    const ensureCounter = (event_id: string, promoter_id: string) => {
      const key = `${event_id}:${promoter_id}`;
      if (!counters.has(key)) {
        counters.set(key, { event_id, promoter_id, codes_generated: 0, scans_confirmed: 0 });
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
      const event_id = (scan as any)?.event_id as string | null;
      const codeRel = Array.isArray((scan as any)?.code) ? (scan as any)?.code?.[0] : (scan as any)?.code;
      const ticketRel = Array.isArray((scan as any)?.ticket) ? (scan as any)?.ticket?.[0] : (scan as any)?.ticket;
      const promoter_id = (codeRel?.promoter_id || ticketRel?.promoter_id || "") as string;
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
              .select("id,code,organizer_id,person:persons(first_name,last_name)")
              .in("id", promoterIdList)
          )
        : { data: [] as any[] };
    const promoterMap = new Map<string, { code: string; name: string; organizer_id: string | null }>();
    for (const promoter of promoterRows || []) {
      const personRel = Array.isArray((promoter as any)?.person) ? (promoter as any)?.person?.[0] : (promoter as any)?.person;
      const name = [personRel?.first_name, personRel?.last_name].filter(Boolean).join(" ").trim();
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
          row.codes_generated > 0 ? Number(((row.scans_confirmed / row.codes_generated) * 100).toFixed(2)) : 0;
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
        if (a.organizer_name !== b.organizer_name) return a.organizer_name.localeCompare(b.organizer_name);
        if (a.event_name !== b.event_name) return a.event_name.localeCompare(b.event_name);
        return a.promoter_name.localeCompare(b.promoter_name);
      });

    if (format === "csv") {
      const headers = [
        "organizer_id",
        "organizer_name",
        "event_id",
        "event_name",
        "promoter_id",
        "promoter_code",
        "promoter_name",
        "codes_generated",
        "scans_confirmed",
        "attendance_rate_percent",
      ];
      const csv = toCsv(headers, rows as any);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="report-promoter-performance.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, report, rows });
  }

  if (report === "event_attendance") {
    let scansQuery = applyNotDeleted(
      supabase
        .from("scan_logs")
        .select("id,event_id,ticket_id,code_id,result,created_at")
        .in("event_id", allowedEventIds)
        .eq("result", "valid")
        .order("created_at", { ascending: false })
        .limit(15000)
    );
    if (fromIso) scansQuery = scansQuery.gte("created_at", fromIso);
    if (toIso) scansQuery = scansQuery.lte("created_at", toIso);
    const { data: scansData, error: scansError } = await scansQuery;
    if (scansError) {
      return NextResponse.json({ success: false, error: scansError.message }, { status: 400 });
    }

    const grouped = new Map<string, { scans: number; ticketSet: Set<string>; codeSet: Set<string> }>();
    for (const scan of scansData || []) {
      const event_id = (scan as any).event_id as string;
      if (!grouped.has(event_id)) grouped.set(event_id, { scans: 0, ticketSet: new Set<string>(), codeSet: new Set<string>() });
      const row = grouped.get(event_id)!;
      row.scans += 1;
      if ((scan as any).ticket_id) row.ticketSet.add((scan as any).ticket_id);
      if ((scan as any).code_id) row.codeSet.add((scan as any).code_id);
    }

    const rows = Array.from(grouped.entries()).map(([event_id, metrics]) => {
      const event = eventById.get(event_id);
      return {
        organizer_id: event?.organizer_id || "",
        organizer_name: event?.organizer_name || "",
        event_id,
        event_name: event?.name || "",
        scans_confirmed: metrics.scans,
        unique_tickets_scanned: metrics.ticketSet.size,
        unique_codes_scanned: metrics.codeSet.size,
      };
    });

    if (format === "csv") {
      const headers = [
        "organizer_id",
        "organizer_name",
        "event_id",
        "event_name",
        "scans_confirmed",
        "unique_tickets_scanned",
        "unique_codes_scanned",
      ];
      const csv = toCsv(headers, rows as any);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="report-event-attendance.csv"',
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
    return NextResponse.json({ success: false, error: paymentsError.message }, { status: 400 });
  }

  const salesMap = new Map<string, { paid_count: number; total_amount: number; currency: string }>();
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
    const headers = [
      "organizer_id",
      "organizer_name",
      "event_id",
      "event_name",
      "paid_count",
      "total_amount_raw",
      "total_amount_pen_est",
      "currency",
    ];
    const csv = toCsv(headers, rows as any);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="report-event-sales.csv"',
      },
    });
  }

  return NextResponse.json({ success: true, report, rows });
}
