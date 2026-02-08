import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { createCulqiRefund } from "shared/payments/culqi";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const paymentsEnabled = process.env.ENABLE_CULQI_PAYMENTS === "true";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!paymentsEnabled) {
    return NextResponse.json({ success: false, error: "payments_module_disabled" }, { status: 503 });
  }
  const guard = await requireStaffRole(req, ["admin", "superadmin"]);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const paymentId = typeof body?.payment_id === "string" ? body.payment_id.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "requested_by_client";
  const amountInput = body?.amount != null ? Number(body.amount) : null;

  if (!paymentId) {
    return NextResponse.json({ success: false, error: "payment_id es requerido" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id,charge_id,amount,status,reservation_id,order_id")
    .eq("id", paymentId)
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    return NextResponse.json({ success: false, error: paymentError.message }, { status: 500 });
  }
  if (!payment) {
    return NextResponse.json({ success: false, error: "Pago no encontrado" }, { status: 404 });
  }
  if (!payment.charge_id) {
    return NextResponse.json(
      { success: false, error: "Este pago no tiene charge_id. Gestiona devolución desde CulqiPanel o espera conciliación." },
      { status: 400 }
    );
  }

  const amount = amountInput ?? payment.amount;
  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ success: false, error: "amount debe estar en centimos y ser entero > 0" }, { status: 400 });
  }

  let refundRes: any = null;
  try {
    refundRes = await createCulqiRefund({
      chargeId: payment.charge_id,
      amount,
      reason,
      metadata: {
        payment_id: payment.id,
        reservation_id: payment.reservation_id,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "No se pudo crear devolución en Culqi" }, { status: 502 });
  }

  const updatePayment = await supabase
    .from("payments")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      provider_payload: refundRes,
    })
    .eq("id", payment.id);

  if (updatePayment.error) {
    return NextResponse.json({ success: false, error: updatePayment.error.message }, { status: 500 });
  }

  if (payment.reservation_id) {
    await supabase
      .from("table_reservations")
      .update({
        status: "rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.reservation_id);
  }

  return NextResponse.json({
    success: true,
    paymentId: payment.id,
    orderId: payment.order_id,
    status: "refunded",
    refund: refundRes,
  });
}
