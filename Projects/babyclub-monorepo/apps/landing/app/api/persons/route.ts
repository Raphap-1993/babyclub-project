import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  const dni = req.nextUrl.searchParams.get("dni")?.trim() || "";
  if (!dni || dni.length !== 8) {
    return NextResponse.json({ person: null, error: "DNI inválido" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ person: null, error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("persons")
    .select("dni,first_name,last_name,email,phone,birthdate")
    .eq("dni", dni)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ person: null, error: error?.message || "No encontrado" }, { status: 404 });
  }

  return NextResponse.json({ person: data });
}
