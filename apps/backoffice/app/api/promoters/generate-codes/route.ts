import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Falta configuración de Supabase" }, { status: 500 });
  }
  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }
  const promoter_id = typeof body?.promoter_id === "string" ? body.promoter_id : "";
  const event_id = typeof body?.event_id === "string" ? body.event_id : "";
  const quantity = Math.min(500, Math.max(1, parseInt(body?.quantity, 10) || 0));

  if (!promoter_id || !event_id || quantity < 1) {
    return NextResponse.json({ success: false, error: "promoter_id, event_id y cantidad son requeridos" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // tomar código del promotor como prefijo si existe
  const promoterQuery = applyNotDeleted(supabase.from("promoters").select("code").eq("id", promoter_id));
  const { data: promData, error: promError } = await promoterQuery.maybeSingle();
  if (promError) return NextResponse.json({ success: false, error: promError.message }, { status: 500 });
  const prefixBase = (promData?.code || "courtesy").replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "courtesy";

  const codesToInsert = Array.from({ length: quantity }).map(() => {
    const suffix = Math.random().toString(36).slice(-4);
    const code = `${prefixBase}-${suffix}`;
    return {
      code,
      event_id,
      promoter_id,
      type: "courtesy",
      is_active: true,
      max_uses: 1,
      uses: 0,
      expires_at: null,
    };
  });

  const { data, error } = await supabase.from("codes").insert(codesToInsert).select("code");
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, codes: data?.map((c: any) => c.code) || [] });
}
