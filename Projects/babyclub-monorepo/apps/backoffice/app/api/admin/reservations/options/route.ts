import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACTIVE_RES_STATUSES = ["pending", "approved", "confirmed", "paid"];

export async function GET() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ events: [], tables: [], products: [], reservations: [], error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [eventsRes, tablesRes, productsRes, reservationsRes] = await Promise.all([
    supabase.from("events").select("id,name,starts_at,is_active").order("starts_at", { ascending: true }),
    supabase
      .from("tables")
      .select("id,name,event_id,ticket_count,min_consumption,price,is_active")
      .order("created_at", { ascending: true }),
    supabase
      .from("table_products")
      .select("id,table_id,name,price,tickets_included,is_active")
      .order("sort_order", { ascending: true }),
    supabase
      .from("table_reservations")
      .select("id,table_id,status,full_name")
      .in("status", ACTIVE_RES_STATUSES)
      .order("created_at", { ascending: false }),
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
