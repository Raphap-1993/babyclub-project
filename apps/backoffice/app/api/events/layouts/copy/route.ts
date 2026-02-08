import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

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
    return NextResponse.json(
      { success: false, error: "Supabase config missing" },
      { status: 500 }
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const toEventId = typeof body?.to_event_id === "string" ? body.to_event_id.trim() : "";
  const fromEventId = typeof body?.from_event_id === "string" ? body.from_event_id.trim() : "";

  if (!toEventId || !fromEventId) {
    return NextResponse.json(
      { success: false, error: "to_event_id and from_event_id are required" },
      { status: 400 }
    );
  }

  try {
    // Helper: Resolve organizer_id
    const { data: orgData } = await supabase
      .from("organizers")
      .select("id")
      .limit(1)
      .maybeSingle();
    const organizerId = orgData?.id;

    if (!organizerId) {
      return NextResponse.json(
        { success: false, error: "No organizer found" },
        { status: 404 }
      );
    }

    // Verify target event exists and belongs to organizer
    const toEventQuery = applyNotDeleted(
      supabase
        .from("events")
        .select("id, organizer_id")
        .eq("id", toEventId)
        .eq("organizer_id", organizerId)
    );
    const { data: toEventData } = await toEventQuery;
    const toEvent = Array.isArray(toEventData) ? toEventData[0] : toEventData;

    if (!toEvent) {
      return NextResponse.json(
        { success: false, error: "Target event not found" },
        { status: 404 }
      );
    }

    // Get tables from source event
    const { data: sourceTables, error: sourceError } = await applyNotDeleted(
      supabase
        .from("tables")
        .select(
          "name, ticket_count, min_consumption, price, pos_x, pos_y, pos_w, pos_h, notes"
        )
        .eq("event_id", fromEventId)
        .eq("organizer_id", organizerId)
    );

    if (sourceError || !sourceTables) {
      return NextResponse.json(
        { success: false, error: "Could not fetch source tables" },
        { status: 500 }
      );
    }

    // Delete existing tables in target event (soft delete)
    const now = new Date().toISOString();
    const { error: deleteError } = await supabase
      .from("tables")
      .update({ deleted_at: now })
      .eq("event_id", toEventId)
      .is("deleted_at", null);

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: "Could not clear target tables" },
        { status: 500 }
      );
    }

    // Copy tables with new positions
    const newTables = sourceTables.map((t: any) => ({
      event_id: toEventId,
      organizer_id: organizerId,
      name: t.name,
      ticket_count: t.ticket_count,
      min_consumption: t.min_consumption,
      price: t.price,
      pos_x: t.pos_x,
      pos_y: t.pos_y,
      pos_w: t.pos_w,
      pos_h: t.pos_h,
      notes: t.notes,
      is_active: true,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("tables")
      .insert(newTables)
      .select("id");

    if (insertError) {
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    // Also copy layout_settings if exists
    const { data: sourceLayout } = await supabase
      .from("layout_settings")
      .select("layout_url, canvas_width, canvas_height, scale, notes")
      .eq("event_id", fromEventId)
      .eq("organizer_id", organizerId)
      .is("deleted_at", null)
      .maybeSingle();

    if (sourceLayout) {
      await supabase.from("layout_settings").insert({
        organizer_id: organizerId,
        event_id: toEventId,
        layout_url: sourceLayout.layout_url,
        canvas_width: sourceLayout.canvas_width,
        canvas_height: sourceLayout.canvas_height,
        scale: sourceLayout.scale,
        notes: sourceLayout.notes,
      });
    }

    return NextResponse.json({
      success: true,
      tables_copied: (inserted || []).length,
      message: `${(inserted || []).length} mesas copiadas del evento anterior`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
