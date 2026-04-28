import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import {
  detectTableLayoutCapabilities,
  readOrganizerLayoutMetadata,
} from "shared/layoutMetadata";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DEFAULT_LAYOUT_SIZE = 60;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildLegacyPositionUpdate(
  update: any,
  canvasWidth: number,
  canvasHeight: number,
) {
  const parsedCenterX = Number(update?.layout_x);
  const parsedCenterY = Number(update?.layout_y);
  const centerX = Number.isFinite(parsedCenterX) ? parsedCenterX : 0;
  const centerY = Number.isFinite(parsedCenterY) ? parsedCenterY : 0;
  const sizeRaw = Number(update?.layout_size);
  const sizePx =
    Number.isFinite(sizeRaw) && sizeRaw > 0 ? sizeRaw : DEFAULT_LAYOUT_SIZE;
  const safeCanvasWidth = Math.max(1, canvasWidth);
  const safeCanvasHeight = Math.max(1, canvasHeight);

  const widthPercent = clamp((sizePx / safeCanvasWidth) * 100, 2, 35);
  const heightPercent = clamp((sizePx / safeCanvasHeight) * 100, 2, 35);
  const xPercent = clamp(
    ((centerX - sizePx / 2) / safeCanvasWidth) * 100,
    0,
    100 - widthPercent,
  );
  const yPercent = clamp(
    ((centerY - sizePx / 2) / safeCanvasHeight) * 100,
    0,
    100 - heightPercent,
  );

  return {
    pos_x: Number(xPercent.toFixed(4)),
    pos_y: Number(yPercent.toFixed(4)),
    pos_w: Number(widthPercent.toFixed(4)),
    pos_h: Number(heightPercent.toFixed(4)),
  };
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status },
    );
  }

  try {
    const { id: organizerId } = await params;
    const body = await req.json();
    const { updates, layout_url } = body;
    const parsedCanvasWidth = Number(body?.canvas_width);
    const parsedCanvasHeight = Number(body?.canvas_height);
    const canvasWidth =
      Number.isFinite(parsedCanvasWidth) && parsedCanvasWidth > 0
        ? Math.round(parsedCanvasWidth)
        : null;
    const canvasHeight =
      Number.isFinite(parsedCanvasHeight) && parsedCanvasHeight > 0
        ? Math.round(parsedCanvasHeight)
        : null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const [organizerSchemaResult, firstTableSchemaResult] = await Promise.all([
      supabase
        .from("organizers")
        .select("*")
        .eq("id", organizerId)
        .limit(1)
        .maybeSingle(),
      updates && Array.isArray(updates) && updates.length > 0
        ? supabase
            .from("tables")
            .select("*")
            .eq("id", updates[0].tableId)
            .eq("organizer_id", organizerId)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (organizerSchemaResult.error) throw organizerSchemaResult.error;
    if (firstTableSchemaResult.error) throw firstTableSchemaResult.error;

    const organizerLayout = readOrganizerLayoutMetadata(
      organizerSchemaResult.data,
    );
    const tableLayoutCapabilities = detectTableLayoutCapabilities(
      firstTableSchemaResult.data,
    );

    // Actualizar posiciones de mesas
    if (updates && Array.isArray(updates)) {
      if (
        !tableLayoutCapabilities.hasLayoutPositionColumns &&
        !tableLayoutCapabilities.hasLegacyPositionColumns
      ) {
        throw new Error("No hay columnas compatibles de layout en tables");
      }

      const syncLegacyPosition = async (update: any) => {
        if (!tableLayoutCapabilities.hasLegacyPositionColumns) return;
        const legacyCanvasWidth = canvasWidth || 800;
        const legacyCanvasHeight = canvasHeight || 600;
        const legacyUpdate = buildLegacyPositionUpdate(
          update,
          legacyCanvasWidth,
          legacyCanvasHeight,
        );
        const { error: legacySyncError } = await supabase
          .from("tables")
          .update(legacyUpdate)
          .eq("id", update.tableId)
          .eq("organizer_id", organizerId);

        if (legacySyncError) throw legacySyncError;
      };

      for (const update of updates) {
        const payload: Record<string, any> = {
          layout_x: update.layout_x,
          layout_y: update.layout_y,
        };
        if (tableLayoutCapabilities.hasLayoutSizeColumn) {
          payload.layout_size = update.layout_size || DEFAULT_LAYOUT_SIZE;
        }

        if (tableLayoutCapabilities.hasLayoutPositionColumns) {
          const { error: tableError } = await supabase
            .from("tables")
            .update(payload)
            .eq("id", update.tableId)
            .eq("organizer_id", organizerId);

          if (tableError) throw tableError;
          await syncLegacyPosition(update);
          continue;
        }
        await syncLegacyPosition(update);
      }
    }

    // Actualizar metadatos del layout del organizer si cambiaron
    const organizerUpdate: Record<string, any> = {};
    if (layout_url !== undefined) {
      organizerUpdate.layout_url = layout_url;
    }
    if (organizerLayout.hasCanvasColumns && canvasWidth !== null) {
      organizerUpdate.layout_canvas_width = canvasWidth;
    }
    if (organizerLayout.hasCanvasColumns && canvasHeight !== null) {
      organizerUpdate.layout_canvas_height = canvasHeight;
    }

    if (Object.keys(organizerUpdate).length > 0) {
      const { error: organizerUpdateError } = await supabase
        .from("organizers")
        .update(organizerUpdate)
        .eq("id", organizerId);

      if (organizerUpdateError) throw organizerUpdateError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving layout:", error);
    return NextResponse.json(
      { error: "Error al guardar el croquis" },
      { status: 500 },
    );
  }
}
