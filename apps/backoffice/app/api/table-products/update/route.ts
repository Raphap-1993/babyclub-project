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

export async function PUT(req: NextRequest) {
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

  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });

  const productQuery = applyNotDeleted(
    supabase.from("table_products").select("id,table_id").eq("id", id).limit(1)
  );
  const { data: existingProduct, error: existingProductError } = await productQuery.maybeSingle();
  if (existingProductError) {
    return NextResponse.json({ success: false, error: existingProductError.message }, { status: 500 });
  }
  if (!existingProduct) {
    return NextResponse.json({ success: false, error: "Producto no encontrado" }, { status: 404 });
  }

  const patch: Record<string, any> = {};
  if (body?.table_id !== undefined) {
    const tableId = String(body.table_id || "").trim();
    if (!tableId) {
      return NextResponse.json({ success: false, error: "table_id inválido" }, { status: 400 });
    }

    const tableQuery = applyNotDeleted(supabase.from("tables").select("id,is_active").eq("id", tableId).limit(1));
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

    patch.table_id = tableId;
  }
  if (body?.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "name inválido" }, { status: 400 });
    }
    patch.name = name;
  }
  if (body?.description !== undefined) patch.description = body.description ? String(body.description).trim() : null;
  if (body?.items !== undefined) {
    patch.items = Array.isArray(body.items) ? body.items.map((i: any) => String(i).trim()).filter(Boolean) : [];
  }
  if (body?.price !== undefined) {
    const price = body.price != null ? Number(body.price) : null;
    if (price != null && (!Number.isFinite(price) || price < 0)) {
      return NextResponse.json({ success: false, error: "price inválido" }, { status: 400 });
    }
    patch.price = price;
  }
  if (body?.cost_price !== undefined) {
    const costPrice = body.cost_price != null ? Number(body.cost_price) : null;
    if (costPrice != null && (!Number.isFinite(costPrice) || costPrice < 0)) {
      return NextResponse.json({ success: false, error: "cost_price inválido" }, { status: 400 });
    }
    patch.cost_price = costPrice;
  }
  if (body?.tickets_included !== undefined) {
    const ticketsIncluded = body.tickets_included != null ? Number(body.tickets_included) : null;
    if (ticketsIncluded != null && (!Number.isFinite(ticketsIncluded) || ticketsIncluded <= 0)) {
      return NextResponse.json({ success: false, error: "tickets_included inválido" }, { status: 400 });
    }
    patch.tickets_included = ticketsIncluded != null ? Math.floor(ticketsIncluded) : null;
  }
  if (body?.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json({ success: false, error: "is_active inválido" }, { status: 400 });
    }
    patch.is_active = body.is_active;
  }
  if (body?.sort_order !== undefined) {
    const sortOrder = Number(body.sort_order);
    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json({ success: false, error: "sort_order inválido" }, { status: 400 });
    }
    patch.sort_order = Math.floor(sortOrder);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: "Nada para actualizar" }, { status: 400 });
  }

  const { data, error } = await supabase.from("table_products").update(patch).eq("id", id).select("id").single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, id: data?.id });
}
