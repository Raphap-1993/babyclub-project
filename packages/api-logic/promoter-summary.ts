import { createClient } from "@supabase/supabase-js";

export interface PromoterBreakdown {
  promoter_id: string;
  name: string;
  tickets: number;
}

export interface PromoterSummary {
  event_id: string;
  name: string;
  date: string;
  total_tickets: number;
  promoters: PromoterBreakdown[];
  error?: string;
}

type EventRow = {
  id: string;
  name: string;
  starts_at: string | null;
};

type TicketRow = {
  event_id: string | null;
  promoter_id: string | null;
  code_id: string | null;
};

type CodeRow = {
  id: string;
  promoter_id: string | null;
  is_active: boolean | null;
};

type PromoterRow = {
  id: string;
  code: string | null;
  person:
    | { first_name: string | null; last_name: string | null }
    | { first_name: string | null; last_name: string | null }[]
    | null;
};

type RpcPromoterRow = {
  event_id: string;
  name: string | null;
  date: string | null;
  total_tickets: number | null;
  promoters: Array<{
    promoter_id: string;
    name: string;
    tickets: number;
  }> | null;
};

const DIRECT_PROMOTER_ID = "direct";
const DIRECT_PROMOTER_LABEL = "Invitacion directa";

function getPromoterLabel(row: PromoterRow): string {
  const person = Array.isArray(row.person) ? row.person[0] : row.person;
  const fullName = `${person?.first_name || ""} ${person?.last_name || ""}`.trim();
  if (fullName) return fullName;
  if (row.code) return row.code;
  return `Promotor ${row.id.slice(0, 6)}`;
}

function normalizePromoters(
  input: RpcPromoterRow["promoters"],
  topLimit: number,
): PromoterBreakdown[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => ({
      promoter_id: typeof item?.promoter_id === "string" ? item.promoter_id : DIRECT_PROMOTER_ID,
      name: typeof item?.name === "string" && item.name.trim() ? item.name : DIRECT_PROMOTER_LABEL,
      tickets: Number(item?.tickets || 0),
    }))
    .sort((a, b) => b.tickets - a.tickets)
    .slice(0, topLimit);
}

async function getPromoterSummaryLegacy(
  supabase: any,
  cutoffIso: string,
  topLimit: number,
): Promise<PromoterSummary[]> {
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
    .select("event_id,promoter_id,code_id")
    .is("deleted_at", null)
    .eq("is_active", true)
    .in("event_id", eventIds);

  const codeIds = Array.from(
    new Set(
      ((ticketsRaw as TicketRow[] | null) || [])
        .map((ticket) => ticket.code_id)
        .filter(Boolean) as string[],
    ),
  );

  let codeMap = new Map<string, CodeRow>();
  let codesErrorMessage: string | undefined;
  if (codeIds.length > 0) {
    const { data: codesRaw, error: codesError } = await supabase
      .from("codes")
      .select("id,promoter_id,is_active")
      .is("deleted_at", null)
      .in("id", codeIds);
    if (codesError) {
      codesErrorMessage = codesError.message;
    } else {
      codeMap = new Map(((codesRaw || []) as CodeRow[]).map((code) => [code.id, code]));
    }
  }

  const byEvent: Record<string, Record<string, number>> = {};
  const promoterIds = new Set<string>();

  (ticketsRaw as TicketRow[] | null)?.forEach((ticket) => {
    const eventId = ticket.event_id;
    if (!eventId) return;

    const code = ticket.code_id ? codeMap.get(ticket.code_id) : null;
    if (code && code.is_active === false) {
      return;
    }

    const promoterId = ticket.promoter_id || code?.promoter_id || DIRECT_PROMOTER_ID;
    if (promoterId !== DIRECT_PROMOTER_ID) {
      promoterIds.add(promoterId);
    }

    if (!byEvent[eventId]) {
      byEvent[eventId] = {};
    }
    byEvent[eventId][promoterId] = (byEvent[eventId][promoterId] || 0) + 1;
  });

  const promoterNames: Record<string, string> = {
    [DIRECT_PROMOTER_ID]: DIRECT_PROMOTER_LABEL,
  };

  if (promoterIds.size > 0) {
    const { data: promotersRaw } = await supabase
      .from("promoters")
      .select("id,code,person:persons(first_name,last_name)")
      .in("id", Array.from(promoterIds));

    (promotersRaw as PromoterRow[] | null)?.forEach((promoter) => {
      promoterNames[promoter.id] = getPromoterLabel(promoter);
    });
  }

  return events.map((event) => {
    const eventCounts = byEvent[event.id] || {};
    const totalTickets = Object.values(eventCounts).reduce((sum, count) => sum + count, 0);

    const promoters: PromoterBreakdown[] = Object.entries(eventCounts)
      .map(([promoterId, count]) => ({
        promoter_id: promoterId,
        name:
          promoterNames[promoterId] ||
          (promoterId === DIRECT_PROMOTER_ID
            ? DIRECT_PROMOTER_LABEL
            : `Promotor ${promoterId.slice(0, 6)}`),
        tickets: count,
      }))
      .sort((a, b) => b.tickets - a.tickets)
      .slice(0, topLimit);

    return {
      event_id: event.id,
      name: event.name,
      date: event.starts_at || "",
      total_tickets: totalTickets,
      promoters,
      error: ticketsError?.message || codesErrorMessage,
    };
  });
}

export async function getPromoterSummaryAll({
  supabaseUrl,
  supabaseKey,
  topLimit = 10,
}: {
  supabaseUrl: string;
  supabaseKey: string;
  topLimit?: number;
}): Promise<PromoterSummary[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const cutoffIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_promoter_summary_all", {
    p_cutoff: cutoffIso,
    p_top_limit: topLimit,
  });

  if (!rpcError && Array.isArray(rpcData)) {
    return (rpcData as RpcPromoterRow[]).map((row) => ({
      event_id: row.event_id,
      name: row.name || row.event_id,
      date: row.date || "",
      total_tickets: Number(row.total_tickets || 0),
      promoters: normalizePromoters(row.promoters, topLimit),
    }));
  }

  return getPromoterSummaryLegacy(supabase, cutoffIso, topLimit);
}
