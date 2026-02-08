import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ success: false, error: "Token requerido" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }

  const event_id = typeof body?.event_id === "string" ? body.event_id.trim() : "";
  const promoter_id = typeof body?.promoter_id === "string" && body.promoter_id ? body.promoter_id.trim() : null;
  const type = typeof body?.type === "string" ? body.type.trim().toLowerCase() : "";
  const quantity = Math.min(500, Math.max(1, parseInt(body?.quantity, 10) || 0));
  const max_uses = Math.max(1, parseInt(body?.max_uses, 10) || 1);
  const prefix = typeof body?.prefix === "string" ? body.prefix : null;
  const notes = typeof body?.notes === "string" ? body.notes : null;
  const expires_at_input = typeof body?.expires_at === "string" ? body.expires_at : null;

  const expires_at = expires_at_input ? new Date(expires_at_input) : null;
  const expires_at_iso = expires_at && !Number.isNaN(expires_at.getTime()) ? expires_at.toISOString() : null;

  if (!event_id || !type) {
    return NextResponse.json({ success: false, error: "event_id y type son requeridos" }, { status: 400 });
  }
  if (!["courtesy", "promoter", "table"].includes(type)) {
    return NextResponse.json({ success: false, error: "type inválido" }, { status: 400 });
  }
  if (type === "promoter" && !promoter_id) {
    return NextResponse.json({ success: false, error: "promoter_id requerido para tipo promoter" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase.rpc("generate_codes_batch", {
    p_event_id: event_id,
    p_promoter_id: promoter_id,
    p_type: type,
    p_quantity: quantity,
    p_expires_at: expires_at_iso,
    p_max_uses: max_uses,
    p_prefix: prefix,
    p_notes: notes,
  });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  const batchId = (data as any[])?.[0]?.batch_id || null;
  const codes =
    (data as any[])?.map((r) => (r.generated_code as string) || (r.code as string) || "").filter(Boolean) || [];

  return NextResponse.json({ success: true, batch_id: batchId, codes });
}
