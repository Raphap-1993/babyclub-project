import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import { ensureEventSalesDefaultsList, isMissingEventSalesColumnsError } from "shared/eventSales";
import { createSupabaseFetchWithTimeout, sanitizeSupabaseErrorMessage, withSupabaseRetry } from "../_utils/supabaseResilience";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ events: [], error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: createSupabaseFetchWithTimeout() },
  });

  let { data, error, retryable } = await withSupabaseRetry<any[]>("events.list_active", () =>
    applyNotDeleted(
      supabase
        .from("events")
        .select("id,name,starts_at,location,is_active,closed_at,sale_status,sale_public_message,early_bird_enabled,early_bird_price_1,early_bird_price_2,all_night_price_1,all_night_price_2")
        .eq("is_active", true)
        .order("starts_at", { ascending: true })
    ),
    1
  );

  if (error && !retryable && isMissingEventSalesColumnsError(error)) {
    const legacy = await withSupabaseRetry<any[]>("events.list_active_legacy_sales_columns", () =>
      applyNotDeleted(
        supabase
          .from("events")
          .select("id,name,starts_at,location,is_active,closed_at")
          .eq("is_active", true)
          .order("starts_at", { ascending: true })
      ),
      1
    );
    data = ensureEventSalesDefaultsList(legacy.data as any[] | null | undefined);
    error = legacy.error;
    retryable = legacy.retryable;
  }

  if (error) {
    if (retryable) {
      return NextResponse.json({ events: [], warning: "temporarily_unavailable" });
    }
    return NextResponse.json({ events: [], error: sanitizeSupabaseErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ events: ensureEventSalesDefaultsList(data as any[] | null | undefined) });
}
