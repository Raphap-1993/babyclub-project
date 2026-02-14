import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function isMissingLayoutCanvasColumns(message?: string | null) {
  const text = (message || "").toLowerCase();
  return (
    text.includes("column") &&
    text.includes("does not exist") &&
    (text.includes("layout_canvas_width") || text.includes("layout_canvas_height"))
  );
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizerId } = await params;
    const body = await req.json();
    const { updates, layout_url } = body;
    const parsedCanvasWidth = Number(body?.canvas_width);
    const parsedCanvasHeight = Number(body?.canvas_height);
    const canvasWidth = Number.isFinite(parsedCanvasWidth) && parsedCanvasWidth > 0 ? Math.round(parsedCanvasWidth) : null;
    const canvasHeight = Number.isFinite(parsedCanvasHeight) && parsedCanvasHeight > 0 ? Math.round(parsedCanvasHeight) : null;

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

    // Actualizar metadatos del layout del organizer si cambiaron
    const organizerUpdate: Record<string, any> = {};
    if (layout_url !== undefined) {
      organizerUpdate.layout_url = layout_url;
    }
    if (canvasWidth !== null) {
      organizerUpdate.layout_canvas_width = canvasWidth;
    }
    if (canvasHeight !== null) {
      organizerUpdate.layout_canvas_height = canvasHeight;
    }

    if (Object.keys(organizerUpdate).length > 0) {
      const { error: organizerUpdateError } = await supabase
        .from("organizers")
        .update(organizerUpdate)
        .eq("id", organizerId);

      if (organizerUpdateError) {
        if (
          isMissingLayoutCanvasColumns(organizerUpdateError.message) &&
          layout_url !== undefined
        ) {
          const { error: legacyUpdateError } = await supabase
            .from("organizers")
            .update({ layout_url })
            .eq("id", organizerId);

          if (legacyUpdateError) throw legacyUpdateError;
        } else if (!isMissingLayoutCanvasColumns(organizerUpdateError.message)) {
          throw organizerUpdateError;
        }
      }
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
