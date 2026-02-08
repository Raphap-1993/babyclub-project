import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, organizers: [], error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, organizers: [], error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await applyNotDeleted(
    supabase
      .from("organizers")
      .select("id,slug,name,is_active,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
  );

  if (error) {
    return NextResponse.json({ success: false, organizers: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, organizers: data || [] });
}

