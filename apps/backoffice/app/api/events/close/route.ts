import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";
import { logProcessEvent } from "../../logs/logger";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req, ["admin", "superadmin"]);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!id) {
    return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  }

  const eventQuery = applyNotDeleted(supabase.from("events").select("id,name,is_active,closed_at").eq("id", id));
  const { data: eventRow, error: eventError } = await eventQuery.maybeSingle();
  if (eventError || !eventRow) {
    return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
  }

  const closedAt = new Date().toISOString();
  const closePayload = {
    is_active: false,
    closed_at: closedAt,
    closed_by: guard.context?.staffId || null,
    close_reason: reason || null,
  };

  const activeCodesQuery = applyNotDeleted(
    supabase.from("codes").select("id", { count: "exact", head: true }).eq("event_id", id).eq("is_active", true)
  );
  const { count: activeCodesCount, error: countError } = await activeCodesQuery;
  if (countError) {
    return NextResponse.json({ success: false, error: countError.message }, { status: 500 });
  }

  const { error: codesError } = await supabase.from("codes").update({ is_active: false }).eq("event_id", id).eq("is_active", true);
  if (codesError) {
    await logProcessEvent({
      supabase,
      category: "events",
      action: "close_event",
      status: "error",
      message: codesError.message,
      meta: { event_id: id, step: "disable_codes" },
    });
    return NextResponse.json({ success: false, error: codesError.message }, { status: 500 });
  }

  // Liberar/anular todas las reservaciones activas del evento
  // En multi-evento, cada evento tiene sus propias mesas y reservas
  // Al cerrar, marcamos las reservas como "deleted_at" para no contaminar próximos eventos
  
  // Primero contar cuántas reservaciones serán archivadas
  const countReservationsQuery = supabase
    .from("table_reservations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id)
    .is("deleted_at", null);
  const { count: reservationsCountToArchive, error: countReservationsError } = await countReservationsQuery;
  
  if (countReservationsError) {
    await logProcessEvent({
      supabase,
      category: "events",
      action: "close_event",
      status: "error",
      message: countReservationsError.message,
      meta: { event_id: id, step: "count_reservations" },
    });
    return NextResponse.json({ success: false, error: countReservationsError.message }, { status: 500 });
  }
  
  // Archivar todas las reservaciones activas
  const { error: reservationsError } = await supabase
    .from("table_reservations")
    .update({ deleted_at: closedAt, status: "archived" })
    .eq("event_id", id)
    .is("deleted_at", null);
  
  if (reservationsError) {
    await logProcessEvent({
      supabase,
      category: "events",
      action: "close_event",
      status: "error",
      message: reservationsError.message,
      meta: { event_id: id, step: "archive_reservations" },
    });
    return NextResponse.json({ success: false, error: reservationsError.message }, { status: 500 });
  }

  const { error: updateEventError } = await supabase.from("events").update(closePayload).eq("id", id);
  if (updateEventError) {
    await logProcessEvent({
      supabase,
      category: "events",
      action: "close_event",
      status: "error",
      message: updateEventError.message,
      meta: { event_id: id, step: "close_event" },
    });
    return NextResponse.json({ success: false, error: updateEventError.message }, { status: 500 });
  }

  await logProcessEvent({
    supabase,
    category: "events",
    action: "close_event",
    status: "success",
    message: `Evento ${eventRow.name || id} cerrado: ${activeCodesCount || 0} códigos desactivados, ${reservationsCountToArchive || 0} reservaciones archivadas`,
    meta: {
      event_id: id,
      closed_at: closedAt,
      disabled_codes: activeCodesCount || 0,
      archived_reservations: reservationsCountToArchive || 0,
      reason: reason || null,
    },
  });

  return NextResponse.json({
    success: true,
    closed: true,
    event: { id: eventRow.id, name: eventRow.name, closed_at: closedAt },
    disabled_codes: activeCodesCount || 0,
    archived_reservations: reservationsCountToArchive || 0,
  });
}

