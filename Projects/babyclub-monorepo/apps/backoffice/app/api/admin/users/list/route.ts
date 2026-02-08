import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("staff")
    .select(
      "id,is_active,created_at,auth_user_id,person:persons(id,dni,first_name,last_name,email,phone),role:staff_roles(id,code,name)"
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  const rows = (data as any[])?.map((s) => ({
    id: s.id,
    is_active: s.is_active,
    created_at: s.created_at,
    auth_user_id: s.auth_user_id,
    role: Array.isArray(s.role) ? s.role[0] : s.role,
    person: Array.isArray(s.person) ? s.person[0] : s.person,
  })) || [];

  return NextResponse.json({ success: true, data: rows });
}
