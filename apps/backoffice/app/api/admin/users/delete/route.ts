import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { buildArchivePayload } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function archiveStaffUser(req: NextRequest) {
  const guard = await requireStaffRole(req, ["admin", "superadmin"]);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }

  const staff_id = typeof body?.staff_id === "string" ? body.staff_id.trim() : "";
  if (!staff_id) return NextResponse.json({ success: false, error: "staff_id requerido" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: staffRow, error: staffErr } = await supabase
    .from("staff")
    .select("id,auth_user_id")
    .eq("id", staff_id)
    .maybeSingle();

  if (staffErr) return NextResponse.json({ success: false, error: staffErr.message }, { status: 400 });

  const archivePayload = buildArchivePayload(guard.context?.staffId);
  const { error: updateErr } = await supabase.from("staff").update(archivePayload).eq("id", staff_id);
  if (updateErr) return NextResponse.json({ success: false, error: updateErr.message }, { status: 400 });

  // No borrar auth user: se conserva para auditoría y se bloquea por guard (is_active/deleted_at)
  return NextResponse.json({ success: true, archived: true, staff_id: staffRow?.id ?? staff_id });
}

export async function POST(req: NextRequest) {
  return archiveStaffUser(req);
}
