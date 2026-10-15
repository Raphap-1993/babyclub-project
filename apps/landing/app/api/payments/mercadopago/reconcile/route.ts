import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  fulfillMercadoPagoCheckout,
  notifyMercadoPagoCheckout,
  reconcileMercadoPagoAttempt,
  reconcileMercadoPagoWebhookEvent,
} from "lib/mercadopagoCheckoutServer";
import { mercadoPagoDatabase, mercadoPagoFailure } from "lib/mercadopagoRoute";
import { PaymentServiceError } from "shared/payments/errors";
import { getMercadoPagoConfig } from "shared/payments/mercadopagoConfig";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    getMercadoPagoConfig();
    const expected = process.env.MERCADOPAGO_WORKER_SECRET || "";
    const received =
      request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    if (
      expected.length < 32 ||
      received.length !== expected.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(received))
    )
      throw new PaymentServiceError("No autorizado", 401);
    const db = mercadoPagoDatabase();
    const expired = await db.rpc("mp_expire_checkouts");
    if (expired.error) throw new Error("expiry_failed");
    let checked = 0,
      errors = 0;
    const events = await db
      .from("mp_webhook_events")
      .select("event_key,order_id")
      .in("status", ["received", "error"])
      .order("received_at")
      .limit(5);
    if (events.error) throw new Error("events_failed");
    await Promise.all(
      (events.data || []).map(async (event) => {
        try {
          await reconcileMercadoPagoWebhookEvent(db, event);
        } catch {
          errors++;
        }
      }),
    );
    const attempts = await db
      .from("mp_payment_attempts")
      .select("*")
      .in("status", ["creating", "unknown", "pending"])
      .order("last_checked_at", { nullsFirst: true })
      .order("created_at")
      .limit(5);
    if (attempts.error) throw new Error("attempts_failed");
    await Promise.all(
      (attempts.data || []).map(async (attempt) => {
        try {
          await reconcileMercadoPagoAttempt(db, attempt);
          checked++;
        } catch {
          errors++;
        }
      }),
    );
    const paid = await db
      .from("mp_checkout_sessions")
      .select("id")
      .eq("status", "paid")
      .limit(5);
    if (paid.error) throw new Error("fulfillment_failed");
    await Promise.all(
      (paid.data || []).map(async (session) => {
        try {
          await fulfillMercadoPagoCheckout(db, session.id);
        } catch {
          errors++;
        }
      }),
    );
    const jobs = await db
      .from("mp_notification_jobs")
      .select("session_id")
      .neq("status", "sent")
      .or(`locked_until.is.null,locked_until.lte.${new Date().toISOString()}`)
      .order("attempts")
      .order("created_at")
      .limit(5);
    if (jobs.error) throw new Error("notification_failed");
    await Promise.all(
      (jobs.data || []).map(async (job) => {
        try {
          await notifyMercadoPagoCheckout(db, job.session_id);
        } catch {
          errors++;
        }
      }),
    );
    return NextResponse.json({
      success: true,
      checked,
      errors,
      notificationJobs: jobs.data?.length || 0,
    });
  } catch (error) {
    return mercadoPagoFailure(error);
  }
}
