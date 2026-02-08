import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export async function GET(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase config missing" },
      { status: 500 }
    );
  }

  try {
    // Helper: Resolve organizer_id from default
    const { data: orgData } = await supabase
      .from("organizers")
      .select("id")
      .limit(1)
      .maybeSingle();
    
    const organizerId = orgData?.id;
    if (!organizerId) {
      return NextResponse.json({ success: false, error: "No organizer found" }, { status: 404 });
    }

    // Get closed events with their table layouts
    const { data: closedEvents, error: eventsError } = await applyNotDeleted(
      supabase
        .from("events")
        .select(
          `
          id,
          name,
          closed_at,
          tables (id, name, pos_x, pos_y, pos_w, pos_h, ticket_count, min_consumption, price)
        `
        )
        .eq("organizer_id", organizerId)
        .eq("is_active", false)
        .not("closed_at", "is", null)
        .order("closed_at", { ascending: false })
        .limit(10)
    );

    if (eventsError) {
      return NextResponse.json(
        { success: false, error: eventsError.message },
        { status: 500 }
      );
    }

    const events = (closedEvents || [])
      .map((evt: any) => ({
        id: evt.id,
        name: evt.name || `Event ${evt.id.slice(0, 6)}`,
        closed_at: evt.closed_at,
        tables_count: Array.isArray(evt.tables) ? evt.tables.length : 0,
        tables: evt.tables || [],
      }))
      .filter((e: any) => e.tables_count > 0);

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
