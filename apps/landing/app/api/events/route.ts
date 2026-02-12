import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import { sanitizeSupabaseErrorMessage, withSupabaseRetry } from "../_utils/supabaseResilience";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ events: [], error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error, retryable } = await withSupabaseRetry<any[]>("events.list_active", () =>
    applyNotDeleted(
      supabase
        .from("events")
        .select("id,name,starts_at,location,is_active")
        .eq("is_active", true)
        .order("starts_at", { ascending: true })
    )
  );

  if (error) {
    if (retryable) {
      return NextResponse.json({ events: [], warning: "temporarily_unavailable" });
    }
    return NextResponse.json({ events: [], error: sanitizeSupabaseErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ events: data || [] });
}
