import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import { sanitizeSupabaseErrorMessage, withSupabaseRetry } from "../_utils/supabaseResilience";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ layout_url: null, error: "Missing Supabase config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Get organizer_id from query params or env
  const searchParams = req.nextUrl.searchParams;
  const organizerId = searchParams.get('organizer_id') || process.env.NEXT_PUBLIC_ORGANIZER_ID;

  // Main source: organizers.layout_url (donde se sube desde el backoffice)
  if (organizerId) {
    const { data: organizerData } = await withSupabaseRetry<{ layout_url: string | null }>("layout.organizer", () =>
      applyNotDeleted(
        supabase
          .from("organizers")
          .select("layout_url")
          .eq("id", organizerId)
      ).maybeSingle()
    );

    if (organizerData?.layout_url) {
      return NextResponse.json({
        layout_url: organizerData.layout_url,
      });
    }
  }

  // Fallback: Legacy single layout (backwards compatibility)
  const { data, error, retryable } = await withSupabaseRetry<{ layout_url: string | null }>("layout.legacy", () =>
    supabase.from("layout_settings").select("layout_url").eq("id", 1).maybeSingle()
  );
  if (error) {
    if (retryable) {
      return NextResponse.json({ layout_url: null, warning: "temporarily_unavailable" });
    }
    return NextResponse.json({ layout_url: null, error: sanitizeSupabaseErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ layout_url: data?.layout_url || null });
}
