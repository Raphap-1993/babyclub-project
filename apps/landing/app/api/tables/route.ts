import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import { createSupabaseFetchWithTimeout, sanitizeSupabaseErrorMessage, withSupabaseRetry } from "../_utils/supabaseResilience";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isMissingLayoutColumns(message?: string | null) {
  const text = (message || "").toLowerCase();
  const hasMissingColumnSignal =
    (text.includes("does not exist") || text.includes("could not find")) &&
    (text.includes("column") || text.includes("schema cache"));
  return (
    hasMissingColumnSignal &&
    (text.includes("layout_x") || text.includes("layout_y") || text.includes("layout_size"))
  );
}

export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ tables: [], error: "Missing Supabase config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: createSupabaseFetchWithTimeout() },
  });

  // Get filters from query params
  const searchParams = req.nextUrl.searchParams;
  const organizerId = searchParams.get('organizer_id') || process.env.NEXT_PUBLIC_ORGANIZER_ID;
  const eventId = searchParams.get('event_id');

  const withFilters = (query: any) => {
    let next = query;
    if (organizerId) {
      next = next.eq("organizer_id", organizerId);
    }
    if (eventId) {
      next = next.eq("event_id", eventId);
    }
    return next;
  };

  const selectWithLayout = `
      id,name,event_id,organizer_id,ticket_count,min_consumption,price,is_active,notes,pos_x,pos_y,pos_w,pos_h,layout_x,layout_y,layout_size,
      event:events(id,name,starts_at,organizer_id),
      table_reservations(status,created_at,deleted_at),
      products:table_products(id,name,description,items,price,tickets_included,is_active,sort_order,deleted_at)
    `;
  const selectLegacyOnly = `
      id,name,event_id,organizer_id,ticket_count,min_consumption,price,is_active,notes,pos_x,pos_y,pos_w,pos_h,
      event:events(id,name,starts_at,organizer_id),
      table_reservations(status,created_at,deleted_at),
      products:table_products(id,name,description,items,price,tickets_included,is_active,sort_order,deleted_at)
    `;

  const buildQuery = (selectClause: string) =>
    withFilters(
      applyNotDeleted(
        supabase
          .from("tables")
          .select(selectClause)
          .eq("is_active", true)
          .order("name", { ascending: true })
      )
    );

  let { data, error, retryable } = await withSupabaseRetry<any[]>("tables.list_active", () => buildQuery(selectWithLayout), 1);

  if (error && !retryable && isMissingLayoutColumns(error.message)) {
    const legacyResult = await withSupabaseRetry<any[]>("tables.list_active_legacy_layout_columns", () => buildQuery(selectLegacyOnly), 1);
    data = legacyResult.data?.map((row: any) => ({
      ...row,
      layout_x: null,
      layout_y: null,
      layout_size: null,
    })) || null;
    error = legacyResult.error;
    retryable = legacyResult.retryable;
  }

  if (error) {
    if (retryable) {
      return NextResponse.json({ tables: [], warning: "temporarily_unavailable" });
    }
    return NextResponse.json({ tables: [], error: sanitizeSupabaseErrorMessage(error) }, { status: 500 });
  }

  const normalized =
    data?.map((t: any) => {
      const reservations: any[] = Array.isArray(t.table_reservations) ? t.table_reservations : [];
      const activeReservations = reservations.filter((r) => !r?.deleted_at);
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
