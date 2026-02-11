import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACTIVE_RES_STATUSES = ["pending", "approved", "confirmed", "paid"];

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json(
      { events: [], tables: [], products: [], reservations: [], error: guard.error },
      { status: guard.status }
    );
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ events: [], tables: [], products: [], reservations: [], error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const organizerId = req.nextUrl.searchParams.get("organizer_id")?.trim() || "";

  let eventsQuery = applyNotDeleted(
    supabase.from("events").select("id,name,starts_at,is_active,organizer_id").order("starts_at", { ascending: true })
  );
  if (organizerId) {
    eventsQuery = eventsQuery.eq("organizer_id", organizerId);
  }

  if (!organizerId) {
    const [eventsRes, tablesRes, productsRes, reservationsRes] = await Promise.all([
      eventsQuery,
      applyNotDeleted(
        supabase.from("tables").select("id,name,event_id,ticket_count,min_consumption,price,is_active").order("created_at", { ascending: true })
      ),
      applyNotDeleted(
        supabase.from("table_products").select("id,table_id,name,price,tickets_included,is_active").order("sort_order", { ascending: true })
      ),
      applyNotDeleted(
        supabase
          .from("table_reservations")
          .select("id,table_id,status,full_name")
          .in("status", ACTIVE_RES_STATUSES)
          .order("created_at", { ascending: false })
      ),
    ]);

    const error = eventsRes.error || tablesRes.error || productsRes.error || reservationsRes.error;
    if (error) {
      return NextResponse.json({ events: [], tables: [], products: [], reservations: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      events: eventsRes.data || [],
      tables: tablesRes.data || [],
      products: productsRes.data || [],
      reservations: reservationsRes.data || [],
    });
  }

  const eventsRes = await eventsQuery;
  if (eventsRes.error) {
    return NextResponse.json({ events: [], tables: [], products: [], reservations: [], error: eventsRes.error.message }, { status: 500 });
  }

  const eventRows = eventsRes.data || [];
  const eventIds = eventRows.map((event: any) => event.id).filter(Boolean);

  let tablesQuery = applyNotDeleted(
    supabase.from("tables").select("id,name,event_id,ticket_count,min_consumption,price,is_active").order("created_at", { ascending: true })
  );

  if (organizerId) {
    if (eventIds.length === 0) {
      return NextResponse.json({ events: eventRows, tables: [], products: [], reservations: [] });
    }
    tablesQuery = tablesQuery.in("event_id", eventIds);
  }

  const tablesRes = await tablesQuery;
  if (tablesRes.error) {
    return NextResponse.json({ events: [], tables: [], products: [], reservations: [], error: tablesRes.error.message }, { status: 500 });
  }

  const tableRows = tablesRes.data || [];
  const tableIds = tableRows.map((table: any) => table.id).filter(Boolean);

  let productRows: any[] = [];
  let reservationRows: any[] = [];

  if (organizerId && tableIds.length === 0) {
    return NextResponse.json({ events: eventRows, tables: tableRows, products: [], reservations: [] });
  }

  const [productsRes, reservationsRes] = await Promise.all([
    tableIds.length > 0
      ? applyNotDeleted(
          supabase
            .from("table_products")
            .select("id,table_id,name,price,tickets_included,is_active")
            .in("table_id", tableIds)
            .order("sort_order", { ascending: true })
        )
      : Promise.resolve({ data: [], error: null } as any),
    tableIds.length > 0
      ? applyNotDeleted(
          supabase
            .from("table_reservations")
            .select("id,table_id,status,full_name")
            .in("table_id", tableIds)
            .in("status", ACTIVE_RES_STATUSES)
            .order("created_at", { ascending: false })
        )
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const error = productsRes.error || reservationsRes.error;
  if (error) {
    return NextResponse.json({ events: [], tables: [], products: [], reservations: [], error: error.message }, { status: 500 });
  }

  productRows = productsRes.data || [];
  reservationRows = reservationsRes.data || [];

  return NextResponse.json({
    events: eventRows,
    tables: tableRows,
    products: productRows,
    reservations: reservationRows,
  });
}
