import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { buildArchivePayload } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export async function archivePromoter(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  }

  const { data: promoterRow } = await supabase.from("promoters").select("person_id").eq("id", id).maybeSingle();

  const archivePayload = buildArchivePayload(guard.context?.staffId);
  const { error } = await supabase.from("promoters").update(archivePayload).eq("id", id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Optional: do not delete person to preserve history
  return NextResponse.json({ success: true, archived: true, person_id: promoterRow?.person_id });
}

export async function POST(req: NextRequest) {
  return archivePromoter(req);
}
