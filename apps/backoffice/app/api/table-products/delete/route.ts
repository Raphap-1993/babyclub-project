import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { buildArchivePayload } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

export async function archiveTableProduct(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "";

  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });

  const archivePayload = buildArchivePayload(guard.context?.staffId);
  const { error } = await supabase.from("table_products").update(archivePayload).eq("id", id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, archived: true });
}

export async function DELETE(req: NextRequest) {
  return archiveTableProduct(req);
}
