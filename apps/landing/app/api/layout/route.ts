import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import {
  readLayoutSettingsMetadata,
  readOrganizerLayoutMetadata,
} from "shared/layoutMetadata";
import {
  createSupabaseFetchWithTimeout,
  sanitizeSupabaseErrorMessage,
  withSupabaseRetry,
} from "../_utils/supabaseResilience";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

function isPlaceholderOrganizerId(value?: string | null) {
  return !value || value === ZERO_UUID;
}

export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      {
        layout_url: null,
        canvas_width: null,
        canvas_height: null,
        canvas_source: null,
        error: "Missing Supabase config",
      },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: createSupabaseFetchWithTimeout() },
  });

  // Get organizer_id from query params or env
  const searchParams = req.nextUrl.searchParams;
  const explicitOrganizerId = searchParams.get("organizer_id")?.trim() || "";
  const eventId = searchParams.get("event_id")?.trim() || "";
  const configuredOrganizerId = process.env.NEXT_PUBLIC_ORGANIZER_ID?.trim() || "";
  const organizerWasRequested = Boolean(explicitOrganizerId || eventId);
  let organizerId = explicitOrganizerId || configuredOrganizerId;
  let organizerCanvasWidth: number | null = null;
  let organizerCanvasHeight: number | null = null;

  if (eventId && isPlaceholderOrganizerId(organizerId)) {
    const eventOrganizerQuery = applyNotDeleted(
      supabase.from("events").select("organizer_id").eq("id", eventId).limit(1),
    );
    const { data: eventOrganizer } = await eventOrganizerQuery.maybeSingle();
    organizerId = eventOrganizer?.organizer_id || organizerId;
  }

  if (isPlaceholderOrganizerId(organizerId)) {
    const organizerQuery = applyNotDeleted(
      supabase
        .from("organizers")
        .select("id")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
        .limit(1),
    );
    const { data: fallbackOrganizer } = await organizerQuery.maybeSingle();
    organizerId = fallbackOrganizer?.id || "";
  }

  // Main source: organizers.layout_url (donde se sube desde el backoffice)
  if (organizerId) {
    let {
      data: organizerData,
      error: organizerError,
      retryable: organizerRetryable,
    } = await withSupabaseRetry<Record<string, any>>(
      "layout.organizer",
      () =>
        applyNotDeleted(
          supabase.from("organizers").select("*").eq("id", organizerId),
        ).maybeSingle(),
      1,
    );
    const organizerLayout = readOrganizerLayoutMetadata(organizerData);

    organizerCanvasWidth = organizerLayout.canvasWidth;
    organizerCanvasHeight = organizerLayout.canvasHeight;

    if (organizerLayout.layoutUrl) {
      return NextResponse.json({
        layout_url: organizerLayout.layoutUrl,
        canvas_width: organizerCanvasWidth,
        canvas_height: organizerCanvasHeight,
        canvas_source:
          organizerCanvasWidth != null && organizerCanvasHeight != null
            ? "organizer"
            : null,
      });
    }

    if (organizerError && organizerRetryable) {
      return NextResponse.json({
        layout_url: null,
        canvas_width: organizerCanvasWidth,
        canvas_height: organizerCanvasHeight,
        canvas_source: null,
        warning: "temporarily_unavailable",
      });
    }

    if (organizerWasRequested) {
      return NextResponse.json({
        layout_url: null,
        canvas_width: organizerCanvasWidth,
        canvas_height: organizerCanvasHeight,
        canvas_source: null,
      });
    }
  }

  // Fallback: Legacy single layout (backwards compatibility)
  const { data, error, retryable } = await withSupabaseRetry<
    Record<string, any>
  >(
    "layout.legacy",
    () =>
      supabase.from("layout_settings").select("*").eq("id", 1).maybeSingle(),
    1,
  );

  if (error) {
    if (retryable) {
      return NextResponse.json({
        layout_url: null,
        canvas_width: organizerCanvasWidth,
        canvas_height: organizerCanvasHeight,
        canvas_source: null,
        warning: "temporarily_unavailable",
      });
    }
    return NextResponse.json(
      {
        layout_url: null,
        canvas_width: organizerCanvasWidth,
        canvas_height: organizerCanvasHeight,
        canvas_source: null,
        error: sanitizeSupabaseErrorMessage(error),
      },
      { status: 500 },
    );
  }

  const legacyLayout = readLayoutSettingsMetadata(data);

  return NextResponse.json({
    layout_url: legacyLayout.layoutUrl,
    canvas_width: organizerCanvasWidth ?? legacyLayout.canvasWidth,
    canvas_height: organizerCanvasHeight ?? legacyLayout.canvasHeight,
    canvas_source:
      organizerCanvasWidth != null && organizerCanvasHeight != null
        ? "organizer"
        : "legacy_layout_settings",
  });
}
