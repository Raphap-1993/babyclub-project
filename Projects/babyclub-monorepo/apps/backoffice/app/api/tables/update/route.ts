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
  const event_id = typeof body?.event_id === "string" ? body.event_id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const ticket_count = Number(body?.ticket_count || 1);
  const min_consumption = body?.min_consumption != null ? Number(body.min_consumption) : null;
  const price = body?.price != null ? Number(body.price) : null;
  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;

  if (!id || !event_id || !name) {
    return NextResponse.json({ success: false, error: "id, event_id and name are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tables")
    .update({
      event_id,
      name,
      ticket_count: Number.isFinite(ticket_count) ? ticket_count : 1,
      min_consumption: Number.isFinite(min_consumption) ? min_consumption : null,
      price: Number.isFinite(price) ? price : null,
      notes,
      is_active,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id ?? id });
}
