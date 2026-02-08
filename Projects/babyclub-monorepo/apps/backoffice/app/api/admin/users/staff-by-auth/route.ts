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
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const auth_user_id = typeof body?.auth_user_id === "string" ? body.auth_user_id.trim() : "";
  if (!auth_user_id) {
    return NextResponse.json({ success: false, error: "auth_user_id requerido" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("staff")
    .select("id,person:persons(first_name,last_name)")
    .eq("auth_user_id", auth_user_id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  if (!data?.id) {
    return NextResponse.json({ success: false, error: "Staff no encontrado para este usuario" }, { status: 404 });
  }
  const personRel = Array.isArray((data as any).person) ? (data as any).person?.[0] : (data as any).person;
  const name = personRel ? `${personRel.first_name || ""} ${personRel.last_name || ""}`.trim() : "";
  return NextResponse.json({ success: true, staff_id: data.id, staff_name: name || null });
}
