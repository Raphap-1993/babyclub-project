import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ tables: [], error: "Missing Supabase config" }, { status: 500 });
  }

  const requestUrl = (req as any)?.nextUrl instanceof URL ? (req as any).nextUrl : new URL(req.url);
  const eventId = requestUrl.searchParams.get("event_id")?.trim() || "";

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let tablesQuery = applyNotDeleted(
    supabase
      .from("tables")
      .select(
        `
      id,name,event_id,ticket_count,min_consumption,price,is_active,notes,pos_x,pos_y,pos_w,pos_h,
      table_reservations(status,created_at,deleted_at,event_id),
      products:table_products(id,name,description,items,price,tickets_included,is_active,sort_order,deleted_at)
    `
      )
      .eq("is_active", true)
      .order("name", { ascending: true })
  );

  if (eventId) {
    tablesQuery = tablesQuery.eq("event_id", eventId);
  }

  const { data, error } = await tablesQuery;

  if (error) {
    return NextResponse.json({ tables: [], error: error.message }, { status: 500 });
  }

  const normalized =
    data?.map((t: any) => {
      const reservations: any[] = Array.isArray(t.table_reservations) ? t.table_reservations : [];
      const activeReservations = reservations.filter((r) => {
        if (r?.deleted_at) return false;
        if (!eventId) return true;
        return !r?.event_id || r.event_id === eventId;
      });
      // Bloqueamos la mesa si existe alguna reserva activa (cualquier estado excepto rechazado/cancelado) reciente.
      const inactiveStatuses = new Set(["rejected", "cancelled", "canceled"]);
      const is_reserved = activeReservations.some((r) => {
        const status = (r?.status || "").toLowerCase();
        if (inactiveStatuses.has(status)) return false;
        const created = r?.created_at ? new Date(r.created_at) : null;
        // liberamos si tiene más de 72h
        if (created && Date.now() - created.getTime() > 72 * 60 * 60 * 1000) return false;
        return true;
      });
      return {
        ...t,
        products: (t.products || []).filter((p: any) => !p?.deleted_at),
        is_reserved,
      };
    }) || [];

  return NextResponse.json({ tables: normalized });
}
