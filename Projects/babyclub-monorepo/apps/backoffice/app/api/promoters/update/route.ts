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

  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

  const first_name = typeof body?.first_name === "string" ? body.first_name.trim() : "";
  const last_name = typeof body?.last_name === "string" ? body.last_name.trim() : "";
  const dni = typeof body?.dni === "string" ? body.dni.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : null;
  const instagram = typeof body?.instagram === "string" ? body.instagram.trim() : null;
  const tiktok = typeof body?.tiktok === "string" ? body.tiktok.trim() : null;
  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;

  if (!first_name || !last_name || !dni) {
    return NextResponse.json({ success: false, error: "first_name, last_name and dni are required" }, { status: 400 });
  }
  if (dni.length !== 8) {
    return NextResponse.json({ success: false, error: "dni must be 8 digits" }, { status: 400 });
  }

  const { data: promoterRow, error: fetchError } = await supabase
    .from("promoters")
    .select("person_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !promoterRow) {
    return NextResponse.json({ success: false, error: fetchError?.message || "Promoter not found" }, { status: 404 });
  }

  const person_id = promoterRow.person_id;

  const { error: personError } = await supabase
    .from("persons")
    .update({ first_name, last_name, dni, email: email || null, phone: phone || null })
    .eq("id", person_id);
  if (personError) {
    return NextResponse.json({ success: false, error: personError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("promoters")
    .update({ code: code || null, instagram, tiktok, notes, is_active })
    .eq("id", id)
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id ?? id });
}
