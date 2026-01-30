import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ tables: [], error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ tables: [], error: "Supabase config missing" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("tables")
    .select("id,name,ticket_count,min_consumption,price,is_active,notes,pos_x,pos_y,pos_w,pos_h")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ tables: [], error: error.message }, { status: 500 });
  return NextResponse.json({ tables: data || [] });
}
