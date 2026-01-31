import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

  const reservationQuery = applyNotDeleted(
    supabase
      .from("table_reservations")
      .select(
        "id,full_name,email,phone,voucher_url,status,codes,created_at,table:tables(name,event:events(name,starts_at,location))"
      )
      .eq("id", id)
  );
  const { data, error } = await reservationQuery.maybeSingle();

  if (error || !data) {
    return NextResponse.json({ success: false, error: error?.message || "Reserva no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ success: true, reservation: data });
}
