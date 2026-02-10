import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fallbackLogoUrl = process.env.NEXT_PUBLIC_LOGO_URL || null;

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const code = `${error.code || ""}`.toUpperCase();
  const message = `${error.message || ""}`.toLowerCase();
  return code === "42P01" || code === "PGRST205" || message.includes("does not exist");
}

export async function GET() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ logo_url: fallbackLogoUrl, error: "Missing Supabase config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.from("brand_settings").select("logo_url").eq("id", 1).maybeSingle();
  if (error) {
    if (isMissingRelationError(error)) {
      return NextResponse.json({ logo_url: fallbackLogoUrl });
    }
    return NextResponse.json({ logo_url: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logo_url: data?.logo_url || fallbackLogoUrl });
}
