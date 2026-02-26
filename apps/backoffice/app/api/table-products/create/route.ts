import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
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

  const table_id = typeof body?.table_id === "string" ? body.table_id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const items = Array.isArray(body?.items)
    ? body.items.map((i: any) => String(i).trim()).filter(Boolean)
    : [];
  const price = body?.price != null ? Number(body.price) : null;
  const cost_price = body?.cost_price != null ? Number(body.cost_price) : null;
  const tickets_included = body?.tickets_included != null ? Number(body.tickets_included) : null;
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;
  const sort_order = body?.sort_order != null ? Number(body.sort_order) : 0;

  if (!table_id || !name) {
    return NextResponse.json({ success: false, error: "table_id y name son requeridos" }, { status: 400 });
  }
  if ((price != null && (!Number.isFinite(price) || price < 0)) || (cost_price != null && (!Number.isFinite(cost_price) || cost_price < 0))) {
    return NextResponse.json({ success: false, error: "price/cost_price inválidos" }, { status: 400 });
  }
  if (tickets_included != null && (!Number.isFinite(tickets_included) || tickets_included <= 0)) {
    return NextResponse.json({ success: false, error: "tickets_included debe ser mayor a 0" }, { status: 400 });
  }
  if (!Number.isFinite(sort_order)) {
    return NextResponse.json({ success: false, error: "sort_order inválido" }, { status: 400 });
  }

  const tableQuery = applyNotDeleted(
    supabase.from("tables").select("id,ticket_count,is_active").eq("id", table_id).limit(1)
  );
  const { data: table, error: tableError } = await tableQuery.maybeSingle();
  if (tableError) {
    return NextResponse.json({ success: false, error: tableError.message }, { status: 500 });
  }
  if (!table) {
    return NextResponse.json({ success: false, error: "Mesa no encontrada" }, { status: 404 });
  }
  if (table.is_active === false) {
    return NextResponse.json({ success: false, error: "Mesa inactiva" }, { status: 400 });
  }

  const resolvedTicketsIncluded =
    tickets_included != null ? Math.floor(tickets_included) : Math.max(Number(table.ticket_count || 1), 1);

  const { data, error } = await supabase
    .from("table_products")
    .insert({
      table_id,
      name,
      description,
      items,
      price,
      cost_price,
      tickets_included: resolvedTicketsIncluded,
      is_active,
      sort_order: Math.floor(sort_order),
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}
