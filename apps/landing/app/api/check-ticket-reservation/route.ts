import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const event_id = req.nextUrl.searchParams.get("event_id")?.trim() || "";
  const document = req.nextUrl.searchParams.get("document")?.trim().toLowerCase() || "";

  if (!event_id || !document) {
    return NextResponse.json({ success: false, error: "event_id y document son requeridos" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("table_reservations")
    .select("id,friendly_code,ticket_quantity,status,created_at")
    .eq("event_id", event_id)
    .eq("document", document)
    .eq("sale_origin", "ticket")
    .not("status", "eq", "rejected")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const reservations = data || [];
  const total_tickets = reservations.reduce((sum, r) => sum + (r.ticket_quantity || 0), 0);

  return NextResponse.json({
    success: true,
    has_ticket_reservations: reservations.length > 0,
    total_tickets,
    reservations,
  });
}
