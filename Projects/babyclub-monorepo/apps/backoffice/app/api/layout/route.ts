import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ layout_url: null, error: "Supabase config missing" }, { status: 500 });
  }
  const { data, error } = await supabase.from("layout_settings").select("layout_url").eq("id", 1).maybeSingle();
  if (error) return NextResponse.json({ layout_url: null, error: error.message }, { status: 500 });
  return NextResponse.json({ layout_url: data?.layout_url || null });
}

export async function POST(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }
  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const layout_url = typeof body?.layout_url === "string" ? body.layout_url.trim() : null;
  const { error } = await supabase
    .from("layout_settings")
    .upsert({ id: 1, layout_url, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
