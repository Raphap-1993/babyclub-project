import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import { ensureEventSalesDefaults, evaluateEventSales, isMissingEventSalesColumnsError } from "shared/eventSales";
import { createSupabaseFetchWithTimeout, sanitizeSupabaseErrorMessage, withSupabaseRetry } from "../_utils/supabaseResilience";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACTIVE_RESERVATION_STATUSES = new Set(["pending", "approved", "confirmed", "paid"]);

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

  const searchParams = req.nextUrl.searchParams;
  const organizerId = searchParams.get("organizer_id") || process.env.NEXT_PUBLIC_ORGANIZER_ID;
  const eventId = searchParams.get("event_id");

  const withOrganizerFilter = (query: any) => {
    if (!organizerId) return query;
    return query.eq("organizer_id", organizerId);
  };

  const selectWithLayout = `
      id,name,event_id,organizer_id,ticket_count,min_consumption,price,is_active,notes,pos_x,pos_y,pos_w,pos_h,layout_x,layout_y,layout_size,
      event:events(id,name,starts_at,organizer_id),
      products:table_products(id,name,description,items,price,tickets_included,is_active,sort_order,deleted_at)
    `;
  const selectLegacyOnly = `
      id,name,event_id,organizer_id,ticket_count,min_consumption,price,is_active,notes,pos_x,pos_y,pos_w,pos_h,
      event:events(id,name,starts_at,organizer_id),
      products:table_products(id,name,description,items,price,tickets_included,is_active,sort_order,deleted_at)
    `;

  const buildQuery = (selectClause: string) =>
    withOrganizerFilter(
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

  let tables = data || [];

  // Si existe configuración por evento en table_availability, la respetamos.
  if (eventId) {
    let eventStateResult = await withSupabaseRetry<any>(
      "tables.event_sale_state",
      () =>
        applyNotDeleted(
          supabase
            .from("events")
            .select("id,is_active,closed_at,sale_status,sale_public_message")
            .eq("id", eventId)
            .limit(1)
        ).maybeSingle(),
      1
    );
    if (eventStateResult.error && !eventStateResult.retryable && isMissingEventSalesColumnsError(eventStateResult.error)) {
      const legacyResult = await withSupabaseRetry<any>(
        "tables.event_sale_state_legacy_sales_columns",
        () =>
          applyNotDeleted(
            supabase
              .from("events")
              .select("id,is_active,closed_at")
              .eq("id", eventId)
              .limit(1)
          ).maybeSingle(),
        1
      );
      eventStateResult = {
        ...legacyResult,
        data: legacyResult.data ? ensureEventSalesDefaults(legacyResult.data as any) : legacyResult.data,
      };
    }
    if (eventStateResult.error) {
      if (eventStateResult.retryable) {
        return NextResponse.json({ tables: [], warning: "temporarily_unavailable" });
      }
      return NextResponse.json({ tables: [], error: sanitizeSupabaseErrorMessage(eventStateResult.error) }, { status: 500 });
    }
    if (!eventStateResult.data) {
      return NextResponse.json({ tables: [], error: "Evento no encontrado" }, { status: 404 });
    }
    const saleDecision = evaluateEventSales(ensureEventSalesDefaults(eventStateResult.data as any));
    if (!saleDecision.available) {
      return NextResponse.json({
        tables: [],
        sale_status: saleDecision.sale_status,
        sale_block_reason: saleDecision.block_reason,
        sale_public_message: saleDecision.public_message,
      });
    }

    const availabilityResult = await withSupabaseRetry<any[]>(
      "tables.event_availability",
      () =>
        applyNotDeleted(
          supabase
            .from("table_availability")
            .select("table_id,is_available,custom_price,custom_min_consumption")
            .eq("event_id", eventId)
        ),
      1
    );

    if (availabilityResult.error) {
      if (availabilityResult.retryable) {
        return NextResponse.json({ tables: [], warning: "temporarily_unavailable" });
      }
      return NextResponse.json(
        { tables: [], error: sanitizeSupabaseErrorMessage(availabilityResult.error) },
        { status: 500 }
      );
    }

    const availabilityRows = availabilityResult.data || [];
    if (availabilityRows.length > 0) {
      const availabilityByTable = new Map(
        availabilityRows
          .filter((row: any) => row?.table_id && row?.is_available !== false)
          .map((row: any) => [row.table_id, row])
      );

      tables = tables
        .filter((table: any) => availabilityByTable.has(table.id))
        .map((table: any) => {
          const availability = availabilityByTable.get(table.id);
          return {
            ...table,
            price:
              availability?.custom_price != null
                ? availability.custom_price
                : table.price,
            min_consumption:
              availability?.custom_min_consumption != null
                ? availability.custom_min_consumption
                : table.min_consumption,
          };
        });
    } else {
      // Fallback legacy cuando aún depende de tables.event_id.
      tables = tables.filter((table: any) => !table.event_id || table.event_id === eventId);
    }
  }

  const tableIds = tables.map((table: any) => table.id).filter(Boolean);
  let reservedTableIds = new Set<string>();

  if (tableIds.length > 0) {
    const reservationsResult = await withSupabaseRetry<any[]>(
      "tables.active_reservations",
      () => {
        let query = applyNotDeleted(
          supabase
            .from("table_reservations")
            .select("table_id,status,event_id")
            .in("table_id", tableIds)
        );
        if (eventId) {
          query = query.eq("event_id", eventId);
        }
        return query;
      },
      1
    );

    if (reservationsResult.error) {
      if (reservationsResult.retryable) {
        return NextResponse.json({ tables: [], warning: "temporarily_unavailable" });
      }
      return NextResponse.json(
        { tables: [], error: sanitizeSupabaseErrorMessage(reservationsResult.error) },
        { status: 500 }
      );
    }

    reservedTableIds = new Set(
      (reservationsResult.data || [])
        .filter((reservation: any) => ACTIVE_RESERVATION_STATUSES.has(String(reservation?.status || "").toLowerCase()))
        .map((reservation: any) => reservation.table_id)
        .filter(Boolean)
    );
  }

  const normalized = tables.map((table: any) => ({
    ...table,
    products: (table.products || [])
      .filter((product: any) => !product?.deleted_at && product?.is_active !== false)
      .sort((a: any, b: any) => {
        const orderA = Number.isFinite(Number(a?.sort_order)) ? Number(a.sort_order) : 0;
        const orderB = Number.isFinite(Number(b?.sort_order)) ? Number(b.sort_order) : 0;
        if (orderA !== orderB) return orderA - orderB;
        return String(a?.name || "").localeCompare(String(b?.name || ""), "es", { sensitivity: "base" });
      }),
    is_reserved: reservedTableIds.has(table.id),
  }));

  return NextResponse.json({ tables: normalized });
}
