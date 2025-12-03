import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ promoters: [], error: "Missing Supabase config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("promoters")
    .select("id,is_active,person:persons(first_name,last_name)")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ promoters: [], error: error.message }, { status: 500 });
  }

  const mapped =
    data?.map((p: any) => ({
      id: p.id,
      name: `${p.person?.first_name ?? ""} ${p.person?.last_name ?? ""}`.trim() || "Promotor",
    })) ?? [];

  return NextResponse.json({ promoters: mapped });
}
