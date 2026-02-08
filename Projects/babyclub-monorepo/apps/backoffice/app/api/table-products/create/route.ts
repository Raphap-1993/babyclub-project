import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
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

  const table_id = typeof body?.table_id === "string" ? body.table_id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const items = Array.isArray(body?.items) ? body.items.map((i: any) => String(i)) : [];
  const price = body?.price != null ? Number(body.price) : null;
  const cost_price = body?.cost_price != null ? Number(body.cost_price) : null;
  const tickets_included = body?.tickets_included != null ? Number(body.tickets_included) : null;
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;
  const sort_order = body?.sort_order != null ? Number(body.sort_order) : 0;

  if (!table_id || !name) {
    return NextResponse.json({ success: false, error: "table_id y name son requeridos" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("table_products")
    .insert({ table_id, name, description, items, price, cost_price, tickets_included, is_active, sort_order })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}
