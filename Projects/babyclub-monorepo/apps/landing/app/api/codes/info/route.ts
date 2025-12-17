import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }

  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("codes")
    .select("code,type,promoter_id,event_id,is_active,expires_at")
    .eq("code", code)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Código no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    code: data.code,
    type: data.type || null,
    promoter_id: data.promoter_id || null,
    event_id: data.event_id || null,
    is_active: data.is_active,
    expires_at: data.expires_at,
  });
}
