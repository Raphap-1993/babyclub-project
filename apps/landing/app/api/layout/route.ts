import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import { createSupabaseFetchWithTimeout, sanitizeSupabaseErrorMessage, withSupabaseRetry } from "../_utils/supabaseResilience";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ layout_url: null, canvas_width: null, canvas_height: null, error: "Missing Supabase config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: createSupabaseFetchWithTimeout() },
  });

  // Get organizer_id from query params or env
  const searchParams = req.nextUrl.searchParams;
  const organizerId = searchParams.get('organizer_id') || process.env.NEXT_PUBLIC_ORGANIZER_ID;
  let organizerCanvasWidth: number | null = null;
  let organizerCanvasHeight: number | null = null;

  // Main source: organizers.layout_url (donde se sube desde el backoffice).
  // Nota: no consultamos layout_canvas_* aquí para mantener compatibilidad
  // con proyectos donde esas columnas todavía no existen.
  if (organizerId) {
    const { data: organizerData, error: organizerError, retryable: organizerRetryable } =
      await withSupabaseRetry<{ layout_url: string | null }>(
        "layout.organizer",
        () =>
          applyNotDeleted(
            supabase
              .from("organizers")
              .select("layout_url")
              .eq("id", organizerId)
          ).maybeSingle(),
        1
      );

    if (organizerData?.layout_url) {
      return NextResponse.json({
        layout_url: organizerData.layout_url,
        canvas_width: organizerCanvasWidth,
        canvas_height: organizerCanvasHeight,
      });
    }

    if (organizerError && organizerRetryable) {
      return NextResponse.json({ layout_url: null, canvas_width: organizerCanvasWidth, canvas_height: organizerCanvasHeight, warning: "temporarily_unavailable" });
    }
  }

  // Fallback: Legacy single layout (backwards compatibility)
  const { data, error, retryable } = await withSupabaseRetry<{ layout_url: string | null; canvas_width: number | null; canvas_height: number | null }>(
    "layout.legacy",
    () => supabase.from("layout_settings").select("layout_url,canvas_width,canvas_height").eq("id", 1).maybeSingle(),
    1
  );
  if (error) {
    if (retryable) {
      return NextResponse.json({ layout_url: null, canvas_width: organizerCanvasWidth, canvas_height: organizerCanvasHeight, warning: "temporarily_unavailable" });
    }
    return NextResponse.json(
      { layout_url: null, canvas_width: organizerCanvasWidth, canvas_height: organizerCanvasHeight, error: sanitizeSupabaseErrorMessage(error) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    layout_url: data?.layout_url || null,
    canvas_width: organizerCanvasWidth ?? data?.canvas_width ?? null,
    canvas_height: organizerCanvasHeight ?? data?.canvas_height ?? null,
  });
}
