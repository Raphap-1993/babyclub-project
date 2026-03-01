import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { hasRole } from "shared/auth/roles";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
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

  const { data, error } = await supabase
    .from("staff")
    .select(
      "id,is_active,created_at,auth_user_id,person:persons(id,dni,first_name,last_name,email,phone),role:staff_roles(id,code,name)"
    )
    .eq("id", guard.context.staffId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ success: false, error: error?.message || "Staff no encontrado" }, { status: 404 });
  }

  const roleRel = Array.isArray((data as any).role) ? (data as any).role[0] : (data as any).role;
  const personRel = Array.isArray((data as any).person) ? (data as any).person[0] : (data as any).person;
  const roleCode = typeof roleRel?.code === "string" ? roleRel.code : guard.context.role || null;

  return NextResponse.json({
    success: true,
    data: {
      role_code: roleCode,
      is_door: hasRole(roleCode, ["door"]),
      staff: {
        id: data.id,
        is_active: data.is_active,
        created_at: data.created_at,
        auth_user_id: data.auth_user_id,
        role: roleRel
          ? {
              id: roleRel.id ?? null,
              code: roleRel.code ?? null,
              name: roleRel.name ?? null,
            }
          : null,
        person: personRel
          ? {
              id: personRel.id ?? null,
              dni: personRel.dni ?? null,
              first_name: personRel.first_name ?? "",
              last_name: personRel.last_name ?? "",
              email: personRel.email ?? null,
              phone: personRel.phone ?? null,
            }
          : null,
      },
    },
  });
}
