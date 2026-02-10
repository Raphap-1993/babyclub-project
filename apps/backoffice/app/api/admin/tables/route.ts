import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  const organizer_id = searchParams.get("organizer_id");

  console.log('🔍 /api/admin/tables called with:', { event_id, organizer_id });

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
    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("organizer_id")
      .eq("id", event_id)
      .single();

    if (eventError || !eventData?.organizer_id) {
      console.error("❌ Error fetching event:", eventError);
      return NextResponse.json({ success: false, error: "Evento no encontrado" }, { status: 404 });
    }

    console.log('📍 Event organizer_id:', eventData.organizer_id);

    // Obtener todas las mesas del organizador
    const { data: allTables, error: tablesError } = await supabase
      .from("tables")
      .select("id, name, ticket_count")
      .is("deleted_at", null)
      .eq("organizer_id", eventData.organizer_id)
      .order("name", { ascending: true });

    if (tablesError) {
      console.error("❌ Error fetching tables:", tablesError);
      return NextResponse.json({ success: false, error: tablesError.message }, { status: 500 });
    }

    console.log('📊 Total tables for organizer:', allTables?.length || 0);

    // Obtener reservas activas para este evento
    const { data: reservations, error: reservError } = await supabase
      .from("table_reservations")
      .select("table_id")
      .eq("event_id", event_id)
      .is("deleted_at", null);

    if (reservError) {
      console.error("❌ Error fetching reservations:", reservError);
      return NextResponse.json({ success: false, error: reservError.message }, { status: 500 });
    }

    const reservedTableIds = new Set(reservations?.map(r => r.table_id) || []);
    console.log('🔒 Reserved tables:', reservedTableIds.size);

    // Filtrar solo mesas disponibles (no reservadas)
    const availableTables = allTables?.filter(table => !reservedTableIds.has(table.id)) || [];
    
    console.log('✅ Available tables:', availableTables.length);

    return NextResponse.json({ 
      success: true, 
      tables: availableTables.map(t => ({
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
