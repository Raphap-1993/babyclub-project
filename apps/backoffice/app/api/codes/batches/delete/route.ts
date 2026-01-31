import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { buildArchivePayload } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function archiveBatch(req: NextRequest) {
  const guard = await requireStaffRole(req);
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

  const batch_id = typeof body?.batch_id === "string" ? body.batch_id.trim() : "";
  if (!batch_id) {
    return NextResponse.json({ success: false, error: "batch_id es requerido" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { count: codesCount } = await supabase
    .from("codes")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batch_id);

  const archivePayload = buildArchivePayload(guard.context?.staffId);
  const { error: codesError } = await supabase.from("codes").update(archivePayload).eq("batch_id", batch_id);

  if (codesError) {
    return NextResponse.json({ success: false, error: codesError.message }, { status: 400 });
  }

  const { error: batchError } = await supabase.from("code_batches").update(archivePayload).eq("id", batch_id);
  if (batchError) {
    return NextResponse.json({ success: false, error: batchError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, archived: true, deleted_codes: codesCount ?? 0, batch_id });
}

export async function POST(req: NextRequest) {
  return archiveBatch(req);
}
