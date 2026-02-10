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
  const organizer_id = searchParams.get("organizer_id");

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    let query = supabase
      .from("events")
      .select("id, name, starts_at, location, organizer_id, is_active, force_closed")
      .is("deleted_at", null)
      .order("starts_at", { ascending: false });

    if (organizer_id) {
      query = query.eq("organizer_id", organizer_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching events:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Filtrar eventos activos y no cerrados en JavaScript
    const filteredEvents = data?.filter(event => {
      const isActive = event.is_active !== false; // true o null cuenta como activo
      const isForceClosed = event.force_closed === true; // solo true cuenta como cerrado
      return isActive && !isForceClosed;
    }) || [];

    // Formatear fechas para el frontend
    const events = filteredEvents.map(event => ({
      id: event.id,
      name: event.name,
      date: event.starts_at ? new Date(event.starts_at).toLocaleDateString('es-PE') : '',
      organizer_name: '',
    }));

    return NextResponse.json({ success: true, events });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
