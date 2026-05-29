import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizeCodeType(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) return jsonError(guard.error, guard.status);

  const supabase = getSupabase();
  if (!supabase) return jsonError("Supabase config missing", 500);

  const { data, error } = await supabase
    .from("code_type_policies")
    .select("code_type,requires_expiration,updated_by_staff_id,updated_at")
    .order("code_type", { ascending: true });

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ success: true, data: data || [], policies: data || [] });
}

export async function PUT(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) return jsonError(guard.error, guard.status);

  const supabase = getSupabase();
  if (!supabase) return jsonError("Supabase config missing", 500);

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return jsonError("JSON inválido", 400);
  }

  const code_type = normalizeCodeType(body?.code_type);
  const requires_expiration = typeof body?.requires_expiration === "boolean" ? body.requires_expiration : null;

  if (!code_type) {
    return jsonError("code_type es requerido", 400);
  }
  if (requires_expiration === null) {
    return jsonError("requires_expiration debe ser booleano", 400);
  }

  const policy = {
    code_type,
    requires_expiration,
    updated_by_staff_id: guard.context.staffId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("code_type_policies").upsert(policy, {
    onConflict: "code_type",
  });

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ success: true, policy });
}
