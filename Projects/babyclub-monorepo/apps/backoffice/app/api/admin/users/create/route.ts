import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function findAuthUserIdByEmail(supabase: any, email: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return null;
    const user = data?.users?.find((u: any) => (u.email || "").toLowerCase() === email.toLowerCase());
    return user?.id || null;
  } catch (_err) {
    return null;
  }
}

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

  const dni = typeof body?.dni === "string" ? body.dni.trim() : "";
  const first_name = typeof body?.first_name === "string" ? body.first_name.trim() : "";
  const last_name = typeof body?.last_name === "string" ? body.last_name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : null;
  const password = typeof body?.password === "string" ? body.password : "";
  const role_code = typeof body?.role_code === "string" ? body.role_code.trim() : "";

  if (!dni || !first_name || !last_name || !email || !password || !role_code) {
    return NextResponse.json({ success: false, error: "Faltan campos requeridos" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Rol
  const { data: role, error: roleErr } = await supabase
    .from("staff_roles")
    .select("id,code,name")
    .eq("code", role_code)
    .maybeSingle();
  if (roleErr || !role) return NextResponse.json({ success: false, error: roleErr?.message || "Rol no encontrado" }, { status: 400 });

  // Persona: si ya existe por DNI, actualizamos datos; si no, creamos
  const { data: personExisting } = await supabase.from("persons").select("id").eq("dni", dni).maybeSingle();
  const { data: personData, error: personErr } = await supabase
    .from("persons")
    .upsert({ id: personExisting?.id, dni, first_name, last_name, email, phone }, { onConflict: "dni" })
    .select("id,dni,first_name,last_name,email,phone")
    .maybeSingle();
  if (personErr || !personData)
    return NextResponse.json({ success: false, error: personErr?.message || "No se pudo guardar persona" }, { status: 400 });

  // Crear usuario en Auth o reutilizar si ya existe
  let auth_user_id: string | null = null;
  const { data: authRes, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr) {
    // Si ya existe, buscarlo y reutilizar
    const existing = await findAuthUserIdByEmail(supabase, email);
    if (!existing) {
      return NextResponse.json({ success: false, error: authErr.message || "No se pudo crear usuario" }, { status: 400 });
    }
    auth_user_id = existing;
  } else {
    auth_user_id = authRes?.user?.id || null;
  }
  if (!auth_user_id) return NextResponse.json({ success: false, error: "No se pudo obtener auth_user_id" }, { status: 400 });

  // Crear staff
  // Si ya existe staff con ese auth_user_id, actualizamos rol/persona y devolvemos
  const { data: staffExisting } = await supabase
    .from("staff")
    .select("id")
    .eq("auth_user_id", auth_user_id)
    .maybeSingle();

  let staffRes = null;
  let staffErr = null;
  if (staffExisting?.id) {
    const { data, error } = await supabase
      .from("staff")
      .update({ person_id: personData.id, staff_role_id: role.id, is_active: true })
      .eq("id", staffExisting.id)
      .select("id,is_active,created_at,auth_user_id,person:persons(id,dni,first_name,last_name,email,phone),role:staff_roles(id,code,name)")
      .maybeSingle();
    staffRes = data;
    staffErr = error;
  } else {
    const { data, error } = await supabase
      .from("staff")
      .insert({ auth_user_id, person_id: personData.id, staff_role_id: role.id, is_active: true })
      .select("id,is_active,created_at,auth_user_id,person:persons(id,dni,first_name,last_name,email,phone),role:staff_roles(id,code,name)")
      .maybeSingle();
    staffRes = data;
    staffErr = error;
  }

  if (staffErr || !staffRes) {
    // rollback auth user
    if (!staffExisting) {
      await supabase.auth.admin.deleteUser(auth_user_id);
    }
    return NextResponse.json({ success: false, error: staffErr?.message || "No se pudo crear staff" }, { status: 400 });
  }

  const staff = {
    id: staffRes.id,
    is_active: staffRes.is_active,
    created_at: staffRes.created_at,
    auth_user_id: staffRes.auth_user_id,
    role: Array.isArray(staffRes.role) ? staffRes.role[0] : staffRes.role,
    person: Array.isArray(staffRes.person) ? staffRes.person[0] : staffRes.person,
  };

  return NextResponse.json({ success: true, staff });
}
