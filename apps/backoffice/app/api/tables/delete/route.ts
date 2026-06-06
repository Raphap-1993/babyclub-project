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

export async function archiveTable(req: NextRequest) {
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

  const archivePayload = buildArchivePayload(guard.context?.staffId);
  const { data, error } = await supabase
    .from("tables")
    .update(archivePayload)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  if (!data?.id) {
    return NextResponse.json(
      { success: false, error: "Mesa no encontrada o ya archivada" },
      { status: 404 }
    );
  }

  const availabilityPayload = {
    deleted_at: archivePayload.deleted_at,
    updated_at: archivePayload.deleted_at,
    is_available: false,
  };
  const { error: availabilityError } = await supabase
    .from("table_availability")
    .update(availabilityPayload)
    .eq("table_id", id)
    .is("deleted_at", null);
  if (availabilityError) {
    return NextResponse.json({ success: false, error: availabilityError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, archived: true });
}

export async function POST(req: NextRequest) {
  return archiveTable(req);
}
