import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const ticket_count = Number(body?.ticket_count || 1);
  const min_consumption = body?.min_consumption != null ? Number(body.min_consumption) : null;
  const price = body?.price != null ? Number(body.price) : null;
  const pos_x = body?.pos_x != null ? Number(body.pos_x) : null;
  const pos_y = body?.pos_y != null ? Number(body.pos_y) : null;
  const pos_w = body?.pos_w != null ? Number(body.pos_w) : null;
  const pos_h = body?.pos_h != null ? Number(body.pos_h) : null;
  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;

  if (!name) {
    return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tables")
    .insert({
      name,
      ticket_count: Number.isFinite(ticket_count) ? ticket_count : 1,
      min_consumption: Number.isFinite(min_consumption) ? min_consumption : null,
      price: Number.isFinite(price) ? price : null,
      pos_x: Number.isFinite(pos_x) ? pos_x : null,
      pos_y: Number.isFinite(pos_y) ? pos_y : null,
      pos_w: Number.isFinite(pos_w) ? pos_w : null,
      pos_h: Number.isFinite(pos_h) ? pos_h : null,
      notes,
      is_active,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}
