import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ events: [], error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await applyNotDeleted(
    supabase
      .from("events")
      .select("id,name,starts_at,location,is_active")
      .eq("is_active", true)
      .order("starts_at", { ascending: true })
  );

  if (error) {
    return NextResponse.json({ events: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data || [] });
}
