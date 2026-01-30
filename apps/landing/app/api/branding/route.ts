import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ logo_url: null, error: "Missing Supabase config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.from("brand_settings").select("logo_url").eq("id", 1).maybeSingle();
  if (error) {
    return NextResponse.json({ logo_url: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logo_url: data?.logo_url || null });
}
