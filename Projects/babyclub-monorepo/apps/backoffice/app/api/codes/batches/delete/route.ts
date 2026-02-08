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
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }

  const batch_id = typeof body?.batch_id === "string" ? body.batch_id.trim() : "";
  if (!batch_id) {
    return NextResponse.json({ success: false, error: "batch_id es requerido" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: codesError, count: codesCount } = await supabase
    .from("codes")
    .delete({ count: "exact" })
    .eq("batch_id", batch_id);

  if (codesError) {
    return NextResponse.json({ success: false, error: codesError.message }, { status: 400 });
  }

  const { error: batchError } = await supabase.from("code_batches").delete().eq("id", batch_id);
  if (batchError) {
    return NextResponse.json({ success: false, error: batchError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, deleted_codes: codesCount ?? 0, batch_id });
}
