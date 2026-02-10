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
  code: { promoter_id: string | null } | { promoter_id: string | null }[] | null;
};

type PromoterRow = {
  id: string;
  code: string | null;
  person:
    | { first_name: string | null; last_name: string | null }
    | { first_name: string | null; last_name: string | null }[]
    | null;
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

  const eventIds = events.map((event) => event.id);
  const { data: ticketsRaw, error: ticketsError } = await supabase
    .from("tickets")
    .select("event_id,promoter_id,code:codes(promoter_id)")
    .is("deleted_at", null)
    .in("event_id", eventIds);

  const byEvent: Record<string, Record<string, number>> = {};
  const promoterIds = new Set<string>();

  (ticketsRaw as TicketRow[] | null)?.forEach((ticket) => {
    const eventId = ticket.event_id;
    if (!eventId) return;

    const code = Array.isArray(ticket.code) ? ticket.code[0] : ticket.code;
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
      error: ticketsError ? ticketsError.message : undefined,
    };
  });
}
