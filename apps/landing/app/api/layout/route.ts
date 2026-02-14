import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import { createSupabaseFetchWithTimeout, sanitizeSupabaseErrorMessage, withSupabaseRetry } from "../_utils/supabaseResilience";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function isMissingLayoutSettingsCanvasColumns(message?: string | null) {
  const text = (message || "").toLowerCase();
  const hasMissingColumnSignal =
    (text.includes("does not exist") || text.includes("could not find")) &&
    (text.includes("column") || text.includes("schema cache"));
  return (
    hasMissingColumnSignal &&
    (text.includes("canvas_width") || text.includes("canvas_height") || text.includes("organizer_id"))
  );
}

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
  const loadCanvasFromLayoutSettings = async () => {
    if (organizerId) {
      const organizerScoped = await withSupabaseRetry<{ canvas_width: number | null; canvas_height: number | null }>(
        "layout.organizer_canvas_from_layout_settings",
        () =>
          applyNotDeleted(
            supabase
              .from("layout_settings")
              .select("canvas_width,canvas_height")
              .eq("organizer_id", organizerId)
              .order("updated_at", { ascending: false })
              .limit(1)
          ).maybeSingle(),
        1
      );

      if (!organizerScoped.error) {
        return {
          width: organizerScoped.data?.canvas_width ?? null,
          height: organizerScoped.data?.canvas_height ?? null,
        };
      }

      if (organizerScoped.retryable) {
        return { width: null, height: null };
      }

      if (!isMissingLayoutSettingsCanvasColumns(organizerScoped.error?.message)) {
        console.warn("[layout] organizer scoped layout_settings canvas lookup failed", {
          code: organizerScoped.error?.code || null,
          message: sanitizeSupabaseErrorMessage(organizerScoped.error),
        });
      }
    }

    const legacy = await withSupabaseRetry<{ canvas_width: number | null; canvas_height: number | null }>(
      "layout.legacy_canvas_from_layout_settings",
      () => supabase.from("layout_settings").select("canvas_width,canvas_height").eq("id", 1).maybeSingle(),
      1
    );

    if (!legacy.error) {
      return {
        width: legacy.data?.canvas_width ?? null,
        height: legacy.data?.canvas_height ?? null,
      };
    }

    if (!legacy.retryable && !isMissingLayoutSettingsCanvasColumns(legacy.error?.message)) {
      console.warn("[layout] legacy layout_settings canvas lookup failed", {
        code: legacy.error?.code || null,
        message: sanitizeSupabaseErrorMessage(legacy.error),
      });
    }

    return { width: null, height: null };
  };

  // Main source: organizers.layout_url (donde se sube desde el backoffice)
  if (organizerId) {
    let { data: organizerData, error: organizerError, retryable: organizerRetryable } =
      await withSupabaseRetry<{ layout_url: string | null; layout_canvas_width: number | null; layout_canvas_height: number | null }>(
        "layout.organizer",
        () =>
          applyNotDeleted(
            supabase
              .from("organizers")
              .select("layout_url,layout_canvas_width,layout_canvas_height")
              .eq("id", organizerId)
          ).maybeSingle(),
        1
      );

    if (organizerError && !organizerRetryable && isMissingLayoutCanvasColumns(organizerError.message)) {
      const legacyOrganizer = await withSupabaseRetry<{ layout_url: string | null }>(
        "layout.organizer_legacy_columns",
        () =>
          applyNotDeleted(
            supabase
              .from("organizers")
              .select("layout_url")
              .eq("id", organizerId)
          ).maybeSingle(),
        1
      );

      organizerData = legacyOrganizer.data
        ? {
            layout_url: legacyOrganizer.data.layout_url,
            layout_canvas_width: null,
            layout_canvas_height: null,
          }
        : null;
      organizerError = legacyOrganizer.error;
      organizerRetryable = legacyOrganizer.retryable;
    }

    organizerCanvasWidth = organizerData?.layout_canvas_width ?? null;
    organizerCanvasHeight = organizerData?.layout_canvas_height ?? null;

    if (organizerCanvasWidth == null || organizerCanvasHeight == null) {
      const canvasFromLayoutSettings = await loadCanvasFromLayoutSettings();
      organizerCanvasWidth = organizerCanvasWidth ?? canvasFromLayoutSettings.width;
      organizerCanvasHeight = organizerCanvasHeight ?? canvasFromLayoutSettings.height;
    }

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
  let { data, error, retryable } = await withSupabaseRetry<{ layout_url: string | null; canvas_width: number | null; canvas_height: number | null }>(
    "layout.legacy",
    () => supabase.from("layout_settings").select("layout_url,canvas_width,canvas_height").eq("id", 1).maybeSingle(),
    1
  );

  if (error && !retryable && isMissingLayoutSettingsCanvasColumns(error.message)) {
    const legacyLayoutOnly = await withSupabaseRetry<{ layout_url: string | null }>(
      "layout.legacy_layout_only",
      () => supabase.from("layout_settings").select("layout_url").eq("id", 1).maybeSingle(),
      1
    );

    data = legacyLayoutOnly.data
      ? {
          layout_url: legacyLayoutOnly.data.layout_url,
          canvas_width: null,
          canvas_height: null,
        }
      : null;
    error = legacyLayoutOnly.error;
    retryable = legacyLayoutOnly.retryable;
  }

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
