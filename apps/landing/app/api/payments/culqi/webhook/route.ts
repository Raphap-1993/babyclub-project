import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildReceiptNumber,
  buildWebhookEventKey,
  normalizeCulqiStatus,
  resolveCulqiEventId,
  resolveCulqiEventName,
  resolveCulqiOrder,
} from "shared/payments/culqi";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const paymentsEnabled = process.env.ENABLE_CULQI_PAYMENTS === "true";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!paymentsEnabled) {
    return NextResponse.json({ success: false, error: "payments_module_disabled" }, { status: 503 });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const rawBody = await req.text();
  let payload: any = null;
  try {
    payload = JSON.parse(rawBody);
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid webhook payload" }, { status: 400 });
  }

  const eventName = resolveCulqiEventName(payload) || "unknown";
  const eventId = resolveCulqiEventId(payload);
  const eventKey = buildWebhookEventKey("culqi", rawBody, eventId);
  // Signature is persisted for traceability. Add cryptographic verification once webhook signing spec is finalized.
  const signature = req.headers.get("x-culqi-signature") || null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const eventInsert = await supabase
    .from("payment_webhook_events")
    .insert({
      provider: "culqi",
      event_name: eventName,
      event_key: eventKey,
      signature,
      payload,
      status: "received",
    })
    .select("id")
    .single();

  if (eventInsert.error) {
    if (eventInsert.error.code === "23505") {
      return NextResponse.json({ success: true, duplicated: true, eventKey });
    }
    return NextResponse.json({ success: false, error: eventInsert.error.message }, { status: 500 });
  }

  const webhookEventId = eventInsert.data?.id;
  const orderData = resolveCulqiOrder(payload);
  const orderId = orderData.orderId;
  const paymentStatus = normalizeCulqiStatus(orderData.statusRaw);

  try {
    if (orderId) {
      const { data: payment } = await supabase
        .from("payments")
        .select("id,reservation_id,receipt_number")
        .eq("order_id", orderId)
        .limit(1)
        .maybeSingle();

      let paymentId: string | null = payment?.id || null;

      if (!paymentId) {
        const orphanInsert = await supabase
          .from("payments")
          .insert({
            provider: "culqi",
            status: paymentStatus,
            order_id: orderId,
            charge_id: orderData.chargeId || null,
            amount: orderData.amount ?? 0,
            currency_code: orderData.currencyCode || "PEN",
            customer_email: orderData.customerEmail,
            customer_name: orderData.customerName,
            customer_phone: orderData.customerPhone,
            metadata: orderData.metadata,
            provider_payload: payload,
            paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
            refunded_at: paymentStatus === "refunded" ? new Date().toISOString() : null,
          })
          .select("id,reservation_id,receipt_number")
          .single();

        if (orphanInsert.error) {
          throw new Error(orphanInsert.error.message);
        }
        paymentId = orphanInsert.data?.id || null;
      } else {
        const patch: Record<string, any> = {
          status: paymentStatus,
          charge_id: orderData.chargeId || null,
          amount: orderData.amount ?? 0,
          currency_code: orderData.currencyCode || "PEN",
          customer_email: orderData.customerEmail,
          customer_name: orderData.customerName,
          customer_phone: orderData.customerPhone,
          metadata: orderData.metadata,
          provider_payload: payload,
          updated_at: new Date().toISOString(),
        };
        if (paymentStatus === "paid") patch.paid_at = new Date().toISOString();
        if (paymentStatus === "refunded") patch.refunded_at = new Date().toISOString();

        const updateRes = await supabase.from("payments").update(patch).eq("id", paymentId);
        if (updateRes.error) {
          throw new Error(updateRes.error.message);
        }
      }

      const reservationIdFromMeta =
        typeof orderData.metadata?.reservation_id === "string" ? orderData.metadata.reservation_id : null;
      const reservationId = payment?.reservation_id || reservationIdFromMeta || null;

      if (paymentStatus === "paid" && reservationId) {
        const updateReservation = await supabase
          .from("table_reservations")
          .update({
            status: "approved",
            updated_at: new Date().toISOString(),
          })
          .eq("id", reservationId);
        if (updateReservation.error) {
          throw new Error(updateReservation.error.message);
        }
      }

      if (paymentStatus === "paid" && paymentId && !payment?.receipt_number) {
        const receiptNumber = buildReceiptNumber(orderId);
        await supabase
          .from("payments")
          .update({
            receipt_number: receiptNumber,
            updated_at: new Date().toISOString(),
          })
          .eq("id", paymentId)
          .is("receipt_number", null);
      }
    }

    await supabase
      .from("payment_webhook_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", webhookEventId);
  } catch (err: any) {
    await supabase
      .from("payment_webhook_events")
      .update({
        status: "error",
        processing_error: err?.message || "unknown_error",
        processed_at: new Date().toISOString(),
      })
      .eq("id", webhookEventId);
    return NextResponse.json({ success: false, error: err?.message || "Error procesando webhook" }, { status: 500 });
  }

  return NextResponse.json({ success: true, event: eventName, orderId: orderData.orderId || null, status: paymentStatus });
}
