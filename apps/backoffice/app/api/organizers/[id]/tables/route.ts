import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import { requireStaffRole } from "shared/auth/requireStaff";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/organizers/[id]/tables
 * Obtiene todas las mesas de un organizador
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  const { id: organizerId } = await context.params;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await applyNotDeleted(
      supabase
        .from("tables")
        .select("id, name, ticket_count, price, min_consumption, is_active, notes, created_at")
        .eq("organizer_id", organizerId)
        .order("created_at", { ascending: true })
    );

    if (error) throw error;

    return NextResponse.json({ tables: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizers/[id]/tables
 * Crea una nueva mesa para el organizador
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  const { id: organizerId } = await context.params;

  try {
    const body = await req.json();
    const { name, ticketCount, price, minConsumption, isActive, notes } = body;

    if (!name || !ticketCount) {
      return NextResponse.json(
        { error: "name y ticketCount son requeridos" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
      .from("tables")
      .insert({
        organizer_id: organizerId,
        name,
        ticket_count: ticketCount,
        price: price || 0,
        min_consumption: minConsumption || 0,
        is_active: isActive ?? true,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-crear disponibilidad para todos los eventos activos del organizador
    const { data: events } = await applyNotDeleted(
      supabase
        .from("events")
        .select("id")
        .eq("organizer_id", organizerId)
        .eq("is_active", true)
    );

    if (events && events.length > 0) {
      const availabilities = events.map((event: any) => ({
        table_id: data.id,
        event_id: event.id,
        is_available: true,
      }));

      await supabase.from("table_availability").insert(availabilities);
    }

    return NextResponse.json({ success: true, table: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
