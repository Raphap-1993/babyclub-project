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
  const role_code = typeof body?.role_code === "string" ? body.role_code.trim() : "";
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;
  const dni = typeof body?.dni === "string" ? body.dni.trim() : "";
  const first_name = typeof body?.first_name === "string" ? body.first_name.trim() : "";
  const last_name = typeof body?.last_name === "string" ? body.last_name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : null;
  const password = typeof body?.password === "string" ? body.password : "";

  if (!staff_id || !role_code) return NextResponse.json({ success: false, error: "staff_id y role_code requeridos" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: role, error: roleErr } = await supabase.from("staff_roles").select("id").eq("code", role_code).maybeSingle();
  if (roleErr || !role) return NextResponse.json({ success: false, error: roleErr?.message || "Rol no encontrado" }, { status: 400 });

  // Obtener staff para saber persona y auth
  const { data: staffRow, error: staffErr } = await supabase
    .from("staff")
    .select("id,person_id,auth_user_id")
    .eq("id", staff_id)
    .maybeSingle();
  if (staffErr || !staffRow) return NextResponse.json({ success: false, error: staffErr?.message || "Staff no encontrado" }, { status: 400 });

  // Update person si se envían datos
  if (first_name && last_name && dni) {
    const { error: personErr } = await supabase
      .from("persons")
      .update({ first_name, last_name, dni, email, phone })
      .eq("id", staffRow.person_id);
    if (personErr) return NextResponse.json({ success: false, error: personErr.message }, { status: 400 });
  }

  // Update auth user email/password si se envían
  if (email || password) {
    const updates: any = { };
    if (email) updates.email = email;
    if (password) updates.password = password;
    const { error: authErr } = await supabase.auth.admin.updateUserById(staffRow.auth_user_id, updates);
    if (authErr) return NextResponse.json({ success: false, error: authErr.message }, { status: 400 });
  }

  const { error: updErr } = await supabase
    .from("staff")
    .update({ staff_role_id: role.id, is_active })
    .eq("id", staff_id);

  if (updErr) return NextResponse.json({ success: false, error: updErr.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
