import { createClient, type User } from "@supabase/supabase-js";
import { hasRole } from "./roles";

export type StaffContext = {
  user: User;
  staffId: string;
  role: string | null;
  staff: any;
};

export type StaffGuardResult =
  | { ok: true; context: StaffContext }
  | { ok: false; status: number; error: string };

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function resolveRoleCode(staff: any): string | null {
  const roleRel = Array.isArray(staff?.role) ? staff.role[0] : staff?.role;
  return typeof roleRel?.code === "string" ? roleRel.code : null;
}

export async function getStaffContext(req: Request): Promise<StaffGuardResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return { ok: false, status: 500, error: "Supabase config missing" };
  }

  const token = extractBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: "Auth requerido" };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return { ok: false, status: 401, error: "Sesión inválida" };
  }

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("id,is_active,deleted_at,role:staff_roles(code)")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (staffError || !staff) {
    return { ok: false, status: 403, error: "No autorizado" };
  }

  if (staff.is_active === false) {
    return { ok: false, status: 403, error: "Usuario inactivo" };
  }
  if (staff.deleted_at) {
    return { ok: false, status: 403, error: "Usuario archivado" };
  }

  return {
    ok: true,
    context: {
      user: authData.user,
      staffId: staff.id,
      role: resolveRoleCode(staff),
      staff,
    },
  };
}

export async function requireStaffRole(
  req: Request,
  allowedRoles?: string[]
): Promise<StaffGuardResult> {
  const ctx = await getStaffContext(req);
  if (!ctx.ok) return ctx;

  const role = (ctx.context.role || "").toLowerCase();
  if (!allowedRoles || allowedRoles.length === 0 || allowedRoles.includes("*")) {
    return ctx;
  }

  if (!hasRole(role, allowedRoles)) {
    return { ok: false, status: 403, error: "Rol sin permisos" };
  }
  return ctx;
}
