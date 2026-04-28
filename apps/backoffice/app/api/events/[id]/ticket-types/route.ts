import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";
import {
  applyTicketTypeInputs,
  buildAdminTicketTypes,
  buildLegacyEventPricePayload,
  buildTicketTypeUpsertRows,
  readTicketTypeInputs,
} from "@/lib/ticketTypesAdmin";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EVENT_SELECT =
  "id,name,starts_at,early_bird_enabled,early_bird_price_1,early_bird_price_2,all_night_price_1,all_night_price_2";
const TICKET_TYPE_SELECT =
  "id,code,label,description,sale_phase,ticket_quantity,price,currency_code,is_active,sort_order";

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function loadEventWithTicketTypes(supabase: any, eventId: string) {
  const { data: event, error: eventError } = await applyNotDeleted(
    supabase.from("events").select(EVENT_SELECT),
  )
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) return { error: eventError };
  if (!event) return { notFound: true };

  const { data: rows, error: ticketTypesError } = await supabase
    .from("event_ticket_types")
    .select(TICKET_TYPE_SELECT)
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (ticketTypesError) return { error: ticketTypesError };

  return {
    event,
    ticketTypes: buildAdminTicketTypes(event, rows || []),
  };
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) return jsonError(guard.error, guard.status);

  const supabase = getSupabase();
  if (!supabase) return jsonError("Supabase config missing", 500);

  const { id: eventId } = await context.params;
  const loaded = await loadEventWithTicketTypes(supabase, eventId);

  if (loaded.notFound) return jsonError("Evento no encontrado", 404);
  if (loaded.error) return jsonError(loaded.error.message, 500);

  return NextResponse.json({
    success: true,
    event: loaded.event,
    ticket_types: loaded.ticketTypes,
  });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) return jsonError(guard.error, guard.status);

  const supabase = getSupabase();
  if (!supabase) return jsonError("Supabase config missing", 500);

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return jsonError("Invalid JSON", 400);
  }

  const { id: eventId } = await context.params;
  const parsed = readTicketTypeInputs(body?.ticket_types);
  if (parsed.error || !parsed.ticketTypes) {
    return jsonError(parsed.error || "ticket_types invalido", 400);
  }

  const loaded = await loadEventWithTicketTypes(supabase, eventId);
  if (loaded.notFound) return jsonError("Evento no encontrado", 404);
  if (loaded.error) return jsonError(loaded.error.message, 500);

  const merged = applyTicketTypeInputs(loaded.ticketTypes || [], parsed.ticketTypes);
  if (merged.error || !merged.ticketTypes) {
    return jsonError(merged.error || "Tipos de entrada invalidos", 400);
  }

  const { error: upsertError } = await supabase
    .from("event_ticket_types")
    .upsert(buildTicketTypeUpsertRows(eventId, merged.ticketTypes), {
      onConflict: "event_id,code",
    });

  if (upsertError) {
    return jsonError(`No se pudieron guardar las entradas: ${upsertError.message}`, 500);
  }

  const legacyPayload = buildLegacyEventPricePayload(merged.ticketTypes);
  const { error: eventUpdateError } = await supabase
    .from("events")
    .update(legacyPayload)
    .eq("id", eventId);

  if (eventUpdateError) {
    return jsonError(
      `Entradas guardadas, pero no se pudo sincronizar compatibilidad del evento: ${eventUpdateError.message}`,
      500,
    );
  }

  const reloaded = await loadEventWithTicketTypes(supabase, eventId);

  return NextResponse.json({
    success: true,
    event: reloaded.event || loaded.event,
    ticket_types: reloaded.ticketTypes || merged.ticketTypes,
  });
}
