import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DEFAULT_LAYOUT_SIZE = 60;

function isMissingLayoutCanvasColumns(message?: string | null) {
  const text = (message || "").toLowerCase();
  const hasMissingColumnSignal =
    (text.includes("does not exist") || text.includes("could not find")) &&
    (text.includes("column") || text.includes("schema cache"));
  return (
    hasMissingColumnSignal &&
    (text.includes("layout_canvas_width") || text.includes("layout_canvas_height"))
  );
}

function isMissingTableLayoutColumns(message?: string | null) {
  const text = (message || "").toLowerCase();
  const hasMissingColumnSignal =
    (text.includes("does not exist") || text.includes("could not find")) &&
    (text.includes("column") || text.includes("schema cache"));
  return (
    hasMissingColumnSignal &&
    (text.includes("layout_x") || text.includes("layout_y") || text.includes("layout_size"))
  );
}

function isMissingLegacyPosColumns(message?: string | null) {
  const text = (message || "").toLowerCase();
  const hasMissingColumnSignal =
    (text.includes("does not exist") || text.includes("could not find")) &&
    (text.includes("column") || text.includes("schema cache"));
  return (
    hasMissingColumnSignal &&
    (text.includes("pos_x") || text.includes("pos_y") || text.includes("pos_w") || text.includes("pos_h"))
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildLegacyPositionUpdate(update: any, canvasWidth: number, canvasHeight: number) {
  const parsedCenterX = Number(update?.layout_x);
  const parsedCenterY = Number(update?.layout_y);
  const centerX = Number.isFinite(parsedCenterX) ? parsedCenterX : 0;
  const centerY = Number.isFinite(parsedCenterY) ? parsedCenterY : 0;
  const sizeRaw = Number(update?.layout_size);
  const sizePx = Number.isFinite(sizeRaw) && sizeRaw > 0 ? sizeRaw : DEFAULT_LAYOUT_SIZE;
  const safeCanvasWidth = Math.max(1, canvasWidth);
  const safeCanvasHeight = Math.max(1, canvasHeight);

  const widthPercent = clamp((sizePx / safeCanvasWidth) * 100, 2, 35);
  const heightPercent = clamp((sizePx / safeCanvasHeight) * 100, 2, 35);
  const xPercent = clamp(((centerX - sizePx / 2) / safeCanvasWidth) * 100, 0, 100 - widthPercent);
  const yPercent = clamp(((centerY - sizePx / 2) / safeCanvasHeight) * 100, 0, 100 - heightPercent);

  return {
    pos_x: Number(xPercent.toFixed(4)),
    pos_y: Number(yPercent.toFixed(4)),
    pos_w: Number(widthPercent.toFixed(4)),
    pos_h: Number(heightPercent.toFixed(4)),
  };
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
      const syncLegacyPosition = async (update: any) => {
        const legacyCanvasWidth = canvasWidth || 800;
        const legacyCanvasHeight = canvasHeight || 600;
        const legacyUpdate = buildLegacyPositionUpdate(update, legacyCanvasWidth, legacyCanvasHeight);
        const { error: legacySyncError } = await supabase
          .from("tables")
          .update(legacyUpdate)
          .eq("id", update.tableId)
          .eq("organizer_id", organizerId);

        if (legacySyncError && !isMissingLegacyPosColumns(legacySyncError.message)) {
          throw legacySyncError;
        }
      };

      for (const update of updates) {
        const payload = {
          layout_x: update.layout_x,
          layout_y: update.layout_y,
          layout_size: update.layout_size || DEFAULT_LAYOUT_SIZE,
        };

        const { error: tableError } = await supabase
          .from("tables")
          .update(payload)
          .eq("id", update.tableId)
          .eq("organizer_id", organizerId);

        if (!tableError) {
          await syncLegacyPosition(update);
          continue;
        }

        // Fallback 1: esquemas sin layout_size pero con layout_x/layout_y
        if (isMissingTableLayoutColumns(tableError.message)) {
          const { error: withoutSizeError } = await supabase
            .from("tables")
            .update({
              layout_x: update.layout_x,
              layout_y: update.layout_y,
            })
            .eq("id", update.tableId)
            .eq("organizer_id", organizerId);

          if (!withoutSizeError) {
            await syncLegacyPosition(update);
            continue;
          }

          // Fallback 2: esquemas legacy (pos_x/pos_y/pos_w/pos_h)
          if (isMissingTableLayoutColumns(withoutSizeError.message)) {
            const legacyCanvasWidth = canvasWidth || 800;
            const legacyCanvasHeight = canvasHeight || 600;
            const legacyUpdate = buildLegacyPositionUpdate(update, legacyCanvasWidth, legacyCanvasHeight);
            const { error: legacyError } = await supabase
              .from("tables")
              .update(legacyUpdate)
              .eq("id", update.tableId)
              .eq("organizer_id", organizerId);

            if (!legacyError) continue;
            throw legacyError;
          }

          throw withoutSizeError;
        }

        throw tableError;
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
