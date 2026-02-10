import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizerId } = await params;
    const body = await req.json();
    const { updates, layout_url } = body;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Actualizar posiciones de mesas
    if (updates && Array.isArray(updates)) {
      for (const update of updates) {
        await supabase
          .from("tables")
          .update({
            layout_x: update.layout_x,
            layout_y: update.layout_y,
            layout_size: update.layout_size || 60,
          })
          .eq("id", update.tableId)
          .eq("organizer_id", organizerId);
      }
    }

    // Actualizar URL del layout en organizer si cambió
    if (layout_url !== undefined) {
      await supabase
        .from("organizers")
        .update({ layout_url })
        .eq("id", organizerId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving layout:", error);
    return NextResponse.json(
      { error: "Error al guardar el croquis" },
      { status: 500 }
    );
  }
}
