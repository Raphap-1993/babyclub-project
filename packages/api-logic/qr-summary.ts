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
  code: { type: string | null } | { type: string | null }[] | null;
};

export async function getQrSummaryAll({
  supabaseUrl,
  supabaseKey,
}: {
  supabaseUrl: string;
  supabaseKey: string;
}): Promise<QRSummary[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const nowIso = new Date().toISOString();
  const { data: eventsRaw, error: eventsError } = await supabase
    .from("events")
    .select("id,name,starts_at,is_active,force_closed,deleted_at")
    .is("deleted_at", null)
    .eq("is_active", true)
    .or("force_closed.is.null,force_closed.eq.false")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true });

  if (eventsError || !eventsRaw) {
    return [];
  }

  const events = eventsRaw as EventRow[];
  if (events.length === 0) {
    return [];
  }

  const eventIds = events.map(event => event.id);
  const { data: ticketsRaw, error: ticketsError } = await supabase
    .from("tickets")
    .select("event_id,code:codes(type)")
    .is("deleted_at", null)
    .in("event_id", eventIds);

  const byEvent: Record<string, { by_type: Record<string, number>; total_qr: number }> = {};

  (ticketsRaw as TicketWithCodeRow[] | null)?.forEach(row => {
    const eid = row.event_id;
    if (!eid) return;

    const codeRow = Array.isArray(row.code) ? row.code[0] : row.code;
    const type = codeRow?.type || "desconocido";

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
    error: ticketsError ? ticketsError.message : undefined,
  }));
}
