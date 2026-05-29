import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SUPPORTED_CODE_TYPES = ["courtesy", "promoter", "table"] as const;

type CodeTypePolicyRow = {
  code_type: string;
  requires_expiration: boolean;
  updated_by_staff_id: string | null;
  updated_at: string | null;
};

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function normalizePolicyRow(row: any): CodeTypePolicyRow | null {
  const codeType = typeof row?.code_type === "string" ? row.code_type.trim().toLowerCase() : "";
  if (!codeType || !SUPPORTED_CODE_TYPES.includes(codeType as (typeof SUPPORTED_CODE_TYPES)[number])) {
    return null;
  }

  return {
    code_type: codeType,
    requires_expiration: row?.requires_expiration === true,
    updated_by_staff_id: typeof row?.updated_by_staff_id === "string" ? row.updated_by_staff_id : null,
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : null,
  };
}

function parsePolicyRows(value: unknown) {
  if (!Array.isArray(value)) return { error: "policies debe ser una lista" };

  const rows: CodeTypePolicyRow[] = [];
  for (const entry of value) {
    const codeType = typeof entry?.code_type === "string" ? entry.code_type.trim().toLowerCase() : "";
    if (!SUPPORTED_CODE_TYPES.includes(codeType as (typeof SUPPORTED_CODE_TYPES)[number])) {
      return { error: `code_type inválido: ${String(entry?.code_type || "")}` };
    }
    if (typeof entry?.requires_expiration !== "boolean") {
      return { error: `requires_expiration debe ser boolean para ${codeType}` };
    }

    rows.push({
      code_type: codeType,
      requires_expiration: entry.requires_expiration,
      updated_by_staff_id: null,
      updated_at: null,
    });
  }

  return { rows };
}

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return jsonError(guard.error, guard.status);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return jsonError("Supabase config missing", 500);
  }

  const { data, error } = await supabase
    .from("code_type_policies")
    .select("code_type,requires_expiration,updated_by_staff_id,updated_at")
    .order("code_type", { ascending: true });

  if (error) {
    return jsonError(error.message, 400);
  }

  const policies = SUPPORTED_CODE_TYPES.map((codeType) => {
    const existing = (data || []).find((row: any) => row?.code_type === codeType);
    return (
      normalizePolicyRow(existing) || {
        code_type: codeType,
        requires_expiration: false,
        updated_by_staff_id: null,
        updated_at: null,
      }
    );
  });

  return NextResponse.json({ success: true, policies });
}

export async function PUT(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return jsonError(guard.error, guard.status);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return jsonError("Supabase config missing", 500);
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return jsonError("JSON inválido", 400);
  }

  const parsed = parsePolicyRows(body?.policies);
  if ("error" in parsed) {
    return jsonError(parsed.error || "policies inválidas", 400);
  }

  const nowIso = new Date().toISOString();
  const rows = parsed.rows.map((row) => ({
    code_type: row.code_type,
    requires_expiration: row.requires_expiration,
    updated_by_staff_id: guard.context?.staffId || null,
    updated_at: nowIso,
  }));

  const { error: upsertError } = await supabase
    .from("code_type_policies")
    .upsert(rows, { onConflict: "code_type" });

  if (upsertError) {
    return jsonError(upsertError.message, 400);
  }

  const { data, error } = await supabase
    .from("code_type_policies")
    .select("code_type,requires_expiration,updated_by_staff_id,updated_at")
    .order("code_type", { ascending: true });

  if (error) {
    return jsonError(error.message, 400);
  }

  const policies = SUPPORTED_CODE_TYPES.map((codeType) => {
    const existing = (data || []).find((row: any) => row?.code_type === codeType);
    return (
      normalizePolicyRow(existing) || {
        code_type: codeType,
        requires_expiration: false,
        updated_by_staff_id: null,
        updated_at: null,
      }
    );
  });

  return NextResponse.json({ success: true, policies });
}
