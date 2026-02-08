import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
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
    .select("auth_user_id")
    .eq("id", staff_id)
    .maybeSingle();

  if (staffErr) return NextResponse.json({ success: false, error: staffErr.message }, { status: 400 });

  await supabase.from("staff").delete().eq("id", staff_id);

  if (staffRow?.auth_user_id) {
    await supabase.auth.admin.deleteUser(staffRow.auth_user_id);
  }

  return NextResponse.json({ success: true });
}
