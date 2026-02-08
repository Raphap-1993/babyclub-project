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

  const batch_id = typeof body?.batch_id === "string" ? body.batch_id.trim() : "";
  if (!batch_id) {
    return NextResponse.json({ success: false, error: "batch_id es requerido" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase
    .from("codes")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("batch_id", batch_id)
    .select("id");

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, affected: data?.length ?? 0 });
}
