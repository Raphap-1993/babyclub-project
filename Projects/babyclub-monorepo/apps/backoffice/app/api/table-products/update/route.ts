import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

export async function PUT(req: NextRequest) {
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
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });

  const patch: any = {};
  if (body?.table_id) patch.table_id = String(body.table_id);
  if (body?.name != null) patch.name = String(body.name).trim();
  if (body?.description !== undefined) patch.description = body.description ? String(body.description).trim() : null;
  if (body?.items !== undefined) patch.items = Array.isArray(body.items) ? body.items.map((i: any) => String(i)) : [];
  if (body?.price !== undefined) patch.price = body.price != null ? Number(body.price) : null;
  if (body?.cost_price !== undefined) patch.cost_price = body.cost_price != null ? Number(body.cost_price) : null;
  if (body?.tickets_included !== undefined)
    patch.tickets_included = body.tickets_included != null ? Number(body.tickets_included) : null;
  if (body?.is_active !== undefined) patch.is_active = Boolean(body.is_active);
  if (body?.sort_order !== undefined) patch.sort_order = Number(body.sort_order) || 0;

  const { data, error } = await supabase.from("table_products").update(patch).eq("id", id).select("id").single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, id: data?.id });
}
