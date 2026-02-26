import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, products: [], error: guard.error }, { status: guard.status });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, products: [], error: "Supabase config missing" },
      { status: 500 }
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const tableId = searchParams.get("table_id")?.trim() || "";
  const includeInactive = searchParams.get("include_inactive") === "1";

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let query = applyNotDeleted(
    supabase
      .from("table_products")
      .select("id,table_id,name,description,items,price,tickets_included,is_active,sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
  );

  if (tableId) {
    query = query.eq("table_id", tableId);
  }
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, products: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, products: data || [] });
}
