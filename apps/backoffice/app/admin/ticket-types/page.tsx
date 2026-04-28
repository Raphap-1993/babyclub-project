import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import {
  buildAdminTicketTypes,
  type AdminTicketType,
} from "@/lib/ticketTypesAdmin";
import TicketTypesClient, {
  type TicketTypesEventOption,
} from "./TicketTypesClient";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type SearchParams = Record<string, string | string[] | undefined>;

const EVENT_SELECT =
  "id,name,starts_at,organizer:organizers(name),early_bird_enabled,early_bird_price_1,early_bird_price_2,all_night_price_1,all_night_price_2";
const TICKET_TYPE_SELECT =
  "id,code,label,description,sale_phase,ticket_quantity,price,currency_code,is_active,sort_order";

function organizerName(event: any) {
  const organizer = Array.isArray(event?.organizer)
    ? event.organizer[0]
    : event?.organizer;
  return typeof organizer?.name === "string" ? organizer.name : null;
}

async function getData(params?: SearchParams): Promise<{
  events: TicketTypesEventOption[];
  selectedEventId: string;
  initialTicketTypes: AdminTicketType[];
  error?: string;
}> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      events: [],
      selectedEventId: "",
      initialTicketTypes: [],
      error: "Falta configuración de Supabase",
    };
  }

  const requestedEventId =
    typeof params?.event_id === "string" ? params.event_id : "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: eventsRaw, error: eventsError } = await applyNotDeleted(
    supabase
      .from("events")
      .select(EVENT_SELECT)
      .order("starts_at", { ascending: false })
      .limit(200),
  );

  if (eventsError) {
    return {
      events: [],
      selectedEventId: "",
      initialTicketTypes: [],
      error: eventsError.message,
    };
  }

  const rawEvents = (eventsRaw as any[]) || [];
  const events = rawEvents.map((event) => ({
    id: String(event.id),
    name: String(event.name || "Evento sin nombre"),
    starts_at: typeof event.starts_at === "string" ? event.starts_at : null,
    organizer_name: organizerName(event),
  }));
  const selectedEventId =
    requestedEventId && events.some((event) => event.id === requestedEventId)
      ? requestedEventId
      : events[0]?.id || "";
  const selectedEvent = rawEvents.find((event) => event.id === selectedEventId);

  if (!selectedEventId || !selectedEvent) {
    return { events, selectedEventId, initialTicketTypes: [] };
  }

  const { data: ticketRows, error: ticketRowsError } = await supabase
    .from("event_ticket_types")
    .select(TICKET_TYPE_SELECT)
    .eq("event_id", selectedEventId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (ticketRowsError) {
    return {
      events,
      selectedEventId,
      initialTicketTypes: buildAdminTicketTypes(selectedEvent),
      error: ticketRowsError.message,
    };
  }

  return {
    events,
    selectedEventId,
    initialTicketTypes: buildAdminTicketTypes(
      selectedEvent,
      (ticketRows as any[]) || [],
    ),
  };
}

export const dynamic = "force-dynamic";

export default async function TicketTypesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await getData(params);

  return <TicketTypesClient {...data} />;
}
