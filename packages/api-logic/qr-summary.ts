import { createClient } from "@supabase/supabase-js";

export interface QRSummary {
  event_id: string;
  name: string;
  date: string;
  total_qr: number;
  by_type: Record<string, number>;
  error?: string;
}

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
};

type CodeRow = {
  id: string;
  type: string | null;
  table_reservation_id: string | null;
  is_active: boolean | null;
};

type RpcQrSummaryRow = {
  event_id: string;
  name: string | null;
  date: string | null;
  total_qr: number | null;
  by_type: Record<string, unknown> | null;
};

function normalizeByType(input: Record<string, unknown> | null | undefined): Record<string, number> {
  if (!input || typeof input !== "object") return {};

  return Object.entries(input).reduce<Record<string, number>>((acc, [key, value]) => {
    const parsed = typeof value === "number" ? value : Number(value);
    acc[key] = Number.isFinite(parsed) ? parsed : 0;
    return acc;
  }, {});
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
    .select("event_id,code_id")
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
    }
  }

  const byEvent: Record<string, { by_type: Record<string, number>; total_qr: number }> = {};

  (ticketsRaw as TicketWithCodeRow[] | null)?.forEach((row) => {
    const eid = row.event_id;
    if (!eid) return;

    const codeRow = row.code_id ? codeMap.get(row.code_id) : null;
    if (codeRow && codeRow.is_active === false) {
      return;
    }

    const type = codeRow?.table_reservation_id ? "table" : codeRow?.type || "desconocido";

    if (!byEvent[eid]) {
      byEvent[eid] = { by_type: {}, total_qr: 0 };
    }

    byEvent[eid].by_type[type] = (byEvent[eid].by_type[type] || 0) + 1;
    byEvent[eid].total_qr += 1;
  });

  return events.map((event) => ({
    event_id: event.id,
    name: event.name,
    date: event.starts_at || "",
    total_qr: byEvent[event.id]?.total_qr || 0,
    by_type: byEvent[event.id]?.by_type || {},
    error: ticketsError?.message || codesErrorMessage,
  }));
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
    return (rpcData as RpcQrSummaryRow[]).map((row) => ({
      event_id: row.event_id,
      name: row.name || row.event_id,
      date: row.date || "",
      total_qr: Number(row.total_qr || 0),
      by_type: normalizeByType(row.by_type),
    }));
  }

  return getQrSummaryLegacy(supabase, cutoffIso);
}
