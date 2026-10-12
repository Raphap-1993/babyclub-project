import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import {
  ensureEventSalesDefaultsList,
  isMissingEventSalesColumnsError,
} from "shared/eventSales";
import { normalizeTicketTypesFromEvent } from "shared/ticketTypes";
import {
  createSupabaseFetchWithTimeout,
  sanitizeSupabaseErrorMessage,
  withSupabaseRetry,
} from "../_utils/supabaseResilience";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isMissingTicketTypesRelationError(error: any) {
  if (!error) return false;
  const haystack =
    `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return (
    haystack.includes("event_ticket_types") || haystack.includes("ticket_types")
  );
}

function normalizeEventsForPublicResponse(events: any[] | null | undefined) {
  return ensureEventSalesDefaultsList(events as any[] | null | undefined).map(
    (event: any) => ({
      ...event,
      ticket_types: normalizeTicketTypesFromEvent(event),
    }),
  );
}

function normalizePublicCoverImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\"))
    return url;
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
      ? url
      : null;
  } catch {
    return null;
  }
}

export async function GET() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { events: [], error: "Supabase config missing" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: createSupabaseFetchWithTimeout() },
  });

  let { data, error, retryable } = await withSupabaseRetry<any[]>(
    "events.list_active",
    () =>
      applyNotDeleted(
        supabase
          .from("events")
          .select(
            "id,name,header_image,starts_at,location,organizer_id,is_active,closed_at,sale_status,sale_public_message,early_bird_enabled,early_bird_price_1,early_bird_price_2,all_night_price_1,all_night_price_2,ticket_types:event_ticket_types(id,code,label,description,sale_phase,ticket_quantity,price,currency_code,is_active,sort_order)",
          )
          .eq("is_active", true)
          .order("starts_at", { ascending: true }),
      ),
    1,
  );

  if (
    error &&
    !retryable &&
    (isMissingEventSalesColumnsError(error) ||
      isMissingTicketTypesRelationError(error))
  ) {
    const legacy = await withSupabaseRetry<any[]>(
      "events.list_active_legacy_sales_columns",
      () =>
        applyNotDeleted(
          supabase
            .from("events")
            .select(
              "id,name,header_image,starts_at,location,organizer_id,is_active,closed_at",
            )
            .eq("is_active", true)
            .order("starts_at", { ascending: true }),
        ),
      1,
    );
    data = normalizeEventsForPublicResponse(
      legacy.data as any[] | null | undefined,
    );
    error = legacy.error;
    retryable = legacy.retryable;
  }

  if (error) {
    if (retryable) {
      return NextResponse.json({
        events: [],
        warning: "temporarily_unavailable",
      });
    }
    return NextResponse.json(
      { events: [], error: sanitizeSupabaseErrorMessage(error) },
      { status: 500 },
    );
  }

  const events = normalizeEventsForPublicResponse(
    data as any[] | null | undefined,
  );
  const presentationByEvent = new Map<
    string,
    { cover_image?: string | null; public_description?: string | null }
  >();
  if (events.length) {
    const settings = await withSupabaseRetry<any[]>(
      "events.presentation",
      () =>
        supabase
          .from("event_messages")
          .select("event_id,key,value_text")
          .in(
            "event_id",
            events.map((event) => event.id),
          )
          .in("key", ["cover_image", "public_description"]),
      1,
    );
    if (settings.error)
      return NextResponse.json(
        {
          events: [],
          error: "No se pudo cargar la presentación de los eventos",
        },
        { status: 503 },
      );
    for (const row of settings.data || []) {
      const previous = presentationByEvent.get(row.event_id) || {};
      if (row.key === "cover_image")
        previous.cover_image = normalizePublicCoverImage(row.value_text);
      if (row.key === "public_description")
        previous.public_description =
          typeof row.value_text === "string" ? row.value_text.trim() : null;
      presentationByEvent.set(row.event_id, previous);
    }
  }
  return NextResponse.json({
    events: events.map((event) => ({
      ...event,
      cover_image: presentationByEvent.get(event.id)?.cover_image || null,
      public_description:
        presentationByEvent.get(event.id)?.public_description || null,
    })),
  });
}
