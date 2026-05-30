import { createClient } from "@supabase/supabase-js";

export interface QRSummary {
  event_id: string;
  name: string;
  date: string;
  total_qr: number;
  free_qr?: number;
  courtesy_qr?: number;
  sold_qr?: number;
  table_qr?: number;
  table_count?: number;
  by_type: Record<string, number>;
  error?: string;
}

export type QRSummaryBucket = "free" | "courtesy" | "sold" | "table";

type EventRow = {
  id: string;
  name: string;
  starts_at: string | null;
  is_active: boolean | null;
  force_closed?: boolean | null;
  deleted_at?: string | null;
};

type TicketWithCodeRow = {
  event_id: string | null;
  code_id: string | null;
  table_id: string | null;
};

type CodeRow = {
  id: string;
  type: string | null;
  table_reservation_id: string | null;
  is_active: boolean | null;
};

type ReservationRow = {
  id: string;
  sale_origin: "table" | "ticket" | null;
};

type RpcQrSummaryRow = {
  event_id: string;
  name: string | null;
  date: string | null;
  total_qr: number | null;
  free_qr: number | null;
  courtesy_qr: number | null;
  sold_qr: number | null;
  table_qr: number | null;
  table_count: number | null;
  by_type: Record<string, unknown> | null;
};

type SummaryCounts = Record<QRSummaryBucket, number>;

function makeSummaryCounts(): SummaryCounts {
  return { free: 0, courtesy: 0, sold: 0, table: 0 };
}

function normalizeCodeType(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function isFreeSummaryType(type: string) {
  return type === "free" || type === "promoter_link";
}

function isCourtesySummaryType(type: string) {
  return type === "courtesy" || type === "promoter";
}

function isTableSummaryType(type: string) {
  return type === "table";
}

function isSoldSummaryType(type: string) {
  return type === "general" || type === "sold" || type === "ticket" || type === "entrada" || type === "entradas";
}

export function classifyQrBucket({
  codeType,
  saleOrigin,
  ticketTableId,
  codeReservationId,
}: {
  codeType: string | null;
  saleOrigin: string | null;
  ticketTableId: string | null;
  codeReservationId: string | null;
}): { bucket: QRSummaryBucket; tableKey: string | null } {
  const normalizedType = normalizeCodeType(codeType);
  const normalizedSaleOrigin = normalizeCodeType(saleOrigin);
  const tableKey = ticketTableId || codeReservationId || null;

  if (ticketTableId || normalizedSaleOrigin === "table" || isTableSummaryType(normalizedType)) {
    return { bucket: "table", tableKey };
  }

  if (normalizedSaleOrigin === "ticket") {
    return { bucket: "sold", tableKey: null };
  }

  if (isCourtesySummaryType(normalizedType)) {
    return { bucket: "courtesy", tableKey: null };
  }

  if (isFreeSummaryType(normalizedType)) {
    return { bucket: "free", tableKey: null };
  }

  if (isSoldSummaryType(normalizedType)) {
    return { bucket: "sold", tableKey: null };
  }

  return { bucket: "sold", tableKey: null };
}

export function normalizeByType(input: Record<string, unknown> | null | undefined): SummaryCounts {
  const counts = makeSummaryCounts();
  if (!input || typeof input !== "object") return counts;

  Object.entries(input).forEach(([key, value]) => {
    const parsed = typeof value === "number" ? value : Number(value);
    const qty = Number.isFinite(parsed) ? parsed : 0;
    const normalizedKey = normalizeCodeType(key);

    if (isTableSummaryType(normalizedKey)) {
      counts.table += qty;
      return;
    }
    if (isCourtesySummaryType(normalizedKey)) {
      counts.courtesy += qty;
      return;
    }
    if (isFreeSummaryType(normalizedKey)) {
      counts.free += qty;
      return;
    }
    if (isSoldSummaryType(normalizedKey)) {
      counts.sold += qty;
      return;
    }
    counts.sold += qty;
  });

  return counts;
}

function buildSummaryCounts({
  byType,
  totalQr,
}: {
  byType: SummaryCounts;
  totalQr: number;
}): SummaryCounts {
  const soldFromResidual = Math.max(totalQr - byType.free - byType.courtesy - byType.table, 0);
  return {
    free: byType.free,
    courtesy: byType.courtesy,
    sold: byType.sold > 0 ? byType.sold : soldFromResidual,
    table: byType.table,
  };
}

function mapSummaryRow(row: RpcQrSummaryRow): QRSummary {
  const totalQr = Number(row.total_qr || 0);
  const byType = normalizeByType(row.by_type);
  const counts = buildSummaryCounts({ byType, totalQr });

  return {
    event_id: row.event_id,
    name: row.name || row.event_id,
    date: row.date || "",
    total_qr: totalQr,
    free_qr: Number(row.free_qr ?? counts.free),
    courtesy_qr: Number(row.courtesy_qr ?? counts.courtesy),
    sold_qr: Number(row.sold_qr ?? counts.sold),
    table_qr: Number(row.table_qr ?? counts.table),
    table_count: Number(row.table_count ?? 0),
    by_type: counts,
  };
}

async function getQrSummaryLegacy(supabase: any, cutoffIso: string): Promise<QRSummary[]> {
  const { data: eventsRaw, error: eventsError } = await supabase
    .from("events")
    .select("id,name,starts_at,is_active,force_closed,deleted_at")
    .is("deleted_at", null)
    .eq("is_active", true)
    .or("force_closed.is.null,force_closed.eq.false")
    .gte("starts_at", cutoffIso)
    .order("starts_at", { ascending: true });

  if (eventsError || !eventsRaw) {
    return [];
  }

  const events = eventsRaw as EventRow[];
  if (events.length === 0) {
    return [];
  }

  const eventIds = events.map((event) => event.id);
  const { data: ticketsRaw, error: ticketsError } = await supabase
    .from("tickets")
    .select("event_id,code_id,table_id")
    .is("deleted_at", null)
    .eq("is_active", true)
    .in("event_id", eventIds);

  const codeIds = Array.from(
    new Set(
      ((ticketsRaw as TicketWithCodeRow[] | null) || [])
        .map((ticket) => ticket.code_id)
        .filter(Boolean) as string[],
    ),
  );

  let codeMap = new Map<string, CodeRow>();
  let codesErrorMessage: string | undefined;
  let reservationMap = new Map<string, ReservationRow>();
  let reservationsErrorMessage: string | undefined;

  if (codeIds.length > 0) {
    const { data: codesRaw, error: codesError } = await supabase
      .from("codes")
      .select("id,type,table_reservation_id,is_active")
      .is("deleted_at", null)
      .in("id", codeIds);
    if (codesError) {
      codesErrorMessage = codesError.message;
    } else {
      codeMap = new Map(((codesRaw || []) as CodeRow[]).map((code) => [code.id, code]));
      const reservationIds = Array.from(
        new Set(
          ((codesRaw || []) as CodeRow[])
            .map((code) => code.table_reservation_id)
            .filter(Boolean) as string[],
        ),
      );
      if (reservationIds.length > 0) {
        const { data: reservationsRaw, error: reservationsError } = await supabase
          .from("table_reservations")
          .select("id,sale_origin")
          .is("deleted_at", null)
          .in("id", reservationIds);
        if (reservationsError) {
          reservationsErrorMessage = reservationsError.message;
        } else {
          reservationMap = new Map(
            ((reservationsRaw || []) as ReservationRow[]).map((row) => [row.id, row]),
          );
        }
      }
    }
  }

  const byEvent: Record<string, { by_type: SummaryCounts; total_qr: number; table_count: number }> = {};
  const tableKeysByEvent: Record<string, Set<string>> = {};

  (ticketsRaw as TicketWithCodeRow[] | null)?.forEach((row) => {
    const eid = row.event_id;
    if (!eid) return;

    const codeRow = row.code_id ? codeMap.get(row.code_id) : null;
    if (codeRow && codeRow.is_active === false) {
      return;
    }

    const reservationRow = codeRow?.table_reservation_id
      ? reservationMap.get(codeRow.table_reservation_id)
      : null;
    const classified = classifyQrBucket({
      codeType: codeRow?.type || null,
      saleOrigin: reservationRow?.sale_origin || null,
      ticketTableId: row.table_id || null,
      codeReservationId: codeRow?.table_reservation_id || null,
    });

    if (!byEvent[eid]) {
      byEvent[eid] = { by_type: makeSummaryCounts(), total_qr: 0, table_count: 0 };
      tableKeysByEvent[eid] = new Set<string>();
    }

    byEvent[eid].by_type[classified.bucket] += 1;
    byEvent[eid].total_qr += 1;
    if (classified.bucket === "table" && classified.tableKey) {
      tableKeysByEvent[eid].add(classified.tableKey);
      byEvent[eid].table_count = tableKeysByEvent[eid].size;
    }
  });

  return events.map((event) => {
    const eventCounts = byEvent[event.id];
    const totalQr = eventCounts?.total_qr || 0;
    const counts = buildSummaryCounts({
      byType: eventCounts?.by_type || makeSummaryCounts(),
      totalQr,
    });

    return {
      event_id: event.id,
      name: event.name,
      date: event.starts_at || "",
      total_qr: totalQr,
      free_qr: counts.free,
      courtesy_qr: counts.courtesy,
      sold_qr: counts.sold,
      table_qr: counts.table,
      table_count: eventCounts?.table_count || 0,
      by_type: counts,
      error: ticketsError?.message || codesErrorMessage || reservationsErrorMessage,
    };
  });
}

export async function getQrSummaryAll({
  supabaseUrl,
  supabaseKey,
}: {
  supabaseUrl: string;
  supabaseKey: string;
}): Promise<QRSummary[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const cutoffIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_qr_summary_all", {
    p_cutoff: cutoffIso,
  });

  if (!rpcError && Array.isArray(rpcData)) {
    const rows = rpcData as RpcQrSummaryRow[];
    return rows.map((row) => mapSummaryRow(row));
  }

  return getQrSummaryLegacy(supabase, cutoffIso);
}
