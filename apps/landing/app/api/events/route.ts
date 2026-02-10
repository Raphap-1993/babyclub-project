import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req?: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ events: [], error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const requestUrl = req?.nextUrl instanceof URL ? req.nextUrl : req?.url ? new URL(req.url) : new URL("http://localhost");
  const search = requestUrl.searchParams;
  const organizerId = search.get("organizer_id")?.trim() || "";

  let eventsQuery = applyNotDeleted(
    supabase
      .from("events")
      .select("id,name,starts_at,location,is_active,organizer_id,organizer:organizers(id,slug,name)")
      .eq("is_active", true)
      .order("starts_at", { ascending: true })
  );
  if (organizerId) {
    eventsQuery = eventsQuery.eq("organizer_id", organizerId);
  }

  const { data, error } = await eventsQuery;

  if (error) {
    return NextResponse.json({ events: [], error: error.message }, { status: 500 });
  }

  const events =
    (data || []).map((row: any) => {
      const organizerRel = Array.isArray(row.organizer) ? row.organizer[0] : row.organizer;
      return {
        id: row.id,
        name: row.name,
        starts_at: row.starts_at,
        location: row.location,
        is_active: row.is_active,
        organizer_id: row.organizer_id || organizerRel?.id || null,
        organizer_slug: organizerRel?.slug || null,
        organizer_name: organizerRel?.name || null,
      };
    }) || [];

  return NextResponse.json({ events });
}
