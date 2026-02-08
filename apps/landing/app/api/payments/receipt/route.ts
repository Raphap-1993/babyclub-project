import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const paymentsEnabled = process.env.ENABLE_CULQI_PAYMENTS === "true";

export async function GET(req: NextRequest) {
  if (!paymentsEnabled) {
    return NextResponse.json({ success: false, error: "payments_module_disabled" }, { status: 503 });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const paymentId = searchParams.get("payment_id")?.trim() || "";
  const orderId = searchParams.get("order_id")?.trim() || "";

  if (!paymentId && !orderId) {
    return NextResponse.json({ success: false, error: "payment_id o order_id es requerido" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let query = supabase
    .from("payments")
    .select(
      "id,provider,status,amount,currency_code,customer_name,customer_email,customer_phone,receipt_number,paid_at,created_at,reservation_id,event_id"
    )
    .limit(1);

  if (paymentId) query = query.eq("id", paymentId);
  else query = query.eq("order_id", orderId);

  const { data, error } = await query.maybeSingle();
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ success: false, error: "Comprobante no encontrado" }, { status: 404 });
  }

  let reservation: any = null;
  if (data.reservation_id) {
    const { data: reservationData } = await supabase
      .from("table_reservations")
      .select("id,full_name,event_id")
      .eq("id", data.reservation_id)
      .limit(1)
      .maybeSingle();
    reservation = reservationData || null;
  }

  let event: any = null;
  const eventId = reservation?.event_id || data.event_id;
  if (eventId) {
    const { data: eventData } = await supabase
      .from("events")
      .select("id,name,starts_at,location")
      .eq("id", eventId)
      .limit(1)
      .maybeSingle();
    event = eventData || null;
  }

  return NextResponse.json({
    success: true,
    receipt: {
      payment_id: data.id,
      provider: data.provider,
      status: data.status,
      amount: data.amount,
      currency_code: data.currency_code,
      receipt_number: data.receipt_number,
      issued_at: data.paid_at || data.created_at,
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      customer_phone: data.customer_phone,
      reservation,
      event,
    },
  });
}
