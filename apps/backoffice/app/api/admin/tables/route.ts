import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACTIVE_RESERVATION_STATUSES = ["pending", "approved", "confirmed", "paid"];

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const searchParams = req.nextUrl.searchParams;
  const event_id = searchParams.get("event_id");

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Si no hay event_id, no podemos determinar disponibilidad
    if (!event_id) {
      return NextResponse.json({ 
        success: false, 
        error: "event_id es requerido para listar mesas disponibles" 
      }, { status: 400 });
    }

    // Obtener el organizer_id del evento
    const eventQuery = applyNotDeleted(
      supabase.from("events").select("organizer_id").eq("id", event_id).limit(1)
    );
    const { data: eventData, error: eventError } = await eventQuery.maybeSingle();

    if (eventError || !eventData?.organizer_id) {
      return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
    }

    const [availabilityRes, tablesRes, reservationsRes] = await Promise.all([
      applyNotDeleted(
        supabase
          .from("table_availability")
          .select("table_id,is_available")
          .eq("event_id", event_id)
      ),
      applyNotDeleted(
        supabase
          .from("tables")
          .select("id,name,ticket_count,event_id,is_active")
          .eq("organizer_id", eventData.organizer_id)
          .eq("is_active", true)
          .order("name", { ascending: true })
      ),
      applyNotDeleted(
        supabase
          .from("table_reservations")
          .select("table_id")
          .eq("event_id", event_id)
          .in("status", ACTIVE_RESERVATION_STATUSES)
      ),
    ]);

    if (availabilityRes.error) {
      return NextResponse.json({ success: false, error: availabilityRes.error.message }, { status: 500 });
    }
    if (tablesRes.error) {
      return NextResponse.json({ success: false, error: tablesRes.error.message }, { status: 500 });
    }
    if (reservationsRes.error) {
      return NextResponse.json({ success: false, error: reservationsRes.error.message }, { status: 500 });
    }

    const availabilityRows = availabilityRes.data || [];
    const eventHasScopedAvailability = availabilityRows.length > 0;
    const availableTableIds = new Set(
      availabilityRows
        .filter((row: any) => row?.table_id && row?.is_available !== false)
        .map((row: any) => row.table_id)
    );

    const candidateTables = (tablesRes.data || []).filter((table: any) => {
      if (eventHasScopedAvailability) {
        return availableTableIds.has(table.id);
      }
      return !table.event_id || table.event_id === event_id;
    });

    const reservedTableIds = new Set(
      (reservationsRes.data || [])
        .map((row: any) => row.table_id)
        .filter(Boolean)
    );

    // Filtrar solo mesas disponibles (no reservadas)
    const availableTables = candidateTables.filter(
      (table: any) => !reservedTableIds.has(table.id)
    );

    return NextResponse.json({ 
      success: true, 
      tables: availableTables.map((t: any) => ({
        id: t.id,
        name: t.name,
        ticket_count: t.ticket_count,
        event_id: event_id,
      }))
    });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
