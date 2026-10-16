import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Explicit opt-in: real Mercado Pago SANDBOX requests + loopback database only.
// No production credentials, real wallet, tunnel or customer data are used.
describe.runIf(process.env.BABY_MP_YAPE_SANDBOX === "1")(
  "Yape sandbox / local HTTP checkout",
  () => {
    let env: Record<string, string>, db: any, eventId: string;
    const sessions: any[] = [];
    const base = "http://127.0.0.1:3004";
    function check(result: any) {
      if (result.error) throw new Error(result.error.message);
      return result.data;
    }
    beforeAll(async () => {
      env = parseEnv(readFileSync("apps/landing/.env.local", "utf8")) as Record<
        string,
        string
      >;
      if (
        env.MERCADOPAGO_ENVIRONMENT !== "test" ||
        new URL(env.SUPABASE_URL).hostname !== "127.0.0.1" ||
        env.BABY_EMAIL_TRANSPORT !== "mailpit" ||
        env.VERCEL_ENV
      )
        throw new Error("Sandbox, loopback Supabase and Mailpit required");
      const merchant = await (
        await fetch("https://api.mercadopago.com/users/me", {
          headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` },
        })
      ).json();
      if (
        String(merchant.id) !== env.MERCADOPAGO_COLLECTOR_ID ||
        !merchant.tags?.includes("test_user")
      )
        throw new Error("Test merchant required");
      db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      const seed = check(
        await db
          .from("events")
          .select("*")
          .eq("id", "20000000-0000-4000-8000-000000000001")
          .single(),
      );
      eventId = randomUUID();
      check(
        await db.from("events").insert({
          ...seed,
          id: eventId,
          name: "QA Yape " + eventId.slice(0, 8),
          capacity: 100,
        }),
      );
    });
    afterAll(async () => {
      if (!db || !eventId) return;
      const now = new Date().toISOString();
      for (const table of ["tickets", "codes", "tables"])
        check(
          await db
            .from(table)
            .update({ is_active: false, deleted_at: now })
            .eq("event_id", eventId),
        );
      check(
        await db
          .from("table_reservations")
          .update({ deleted_at: now })
          .eq("event_id", eventId),
      );
      check(
        await db
          .from("events")
          .update({ is_active: false, deleted_at: now })
          .eq("id", eventId),
      );
    });
    async function fixture(table = false) {
      const id = randomUUID(),
        token = randomBytes(32).toString("hex");
      let tableId: string | null = null;
      if (table) {
        const seed = check(
          await db
            .from("tables")
            .select("*")
            .eq("id", "10ef9ed0-9933-4cca-ad8a-4f12d695b4d5")
            .single(),
        );
        tableId = randomUUID();
        check(
          await db.from("tables").insert({
            ...seed,
            id: tableId,
            event_id: eventId,
            name: "QA Yape",
          }),
        );
      }
      const { createHash } = await import("node:crypto");
      check(
        await db.from("table_reservations").insert({
          id,
          event_id: eventId,
          table_id: tableId,
          full_name: "QA Yape " + id.slice(0, 8),
          email: `qa.yape.${id}@testuser.com`,
          doc_type: "dni",
          document: String(95000000 + sessions.length),
          sale_origin: table ? "table" : "ticket",
          status: "pending",
          ticket_quantity: table ? 4 : 1,
          total_ticket_units: table ? 4 : 1,
          online_checkout_key: randomUUID(),
          online_checkout_token_hash: createHash("sha256")
            .update(token)
            .digest("hex"),
          online_amount_cents: table ? 60000 : 4000,
          online_checkout_expires_at: new Date(
            Date.now() + 1200000,
          ).toISOString(),
        }),
      );
      const s = check(
        await db.rpc("mp_open_checkout", {
          p_reservation: id,
          p_token_hash: createHash("sha256").update(token).digest("hex"),
          p_environment: "test",
          p_collector: env.MERCADOPAGO_COLLECTOR_ID,
          p_application: env.MERCADOPAGO_TEST_APPLICATION_ID,
        }),
      );
      const checkout = { ...s, token };
      sessions.push(checkout);
      return checkout;
    }
    async function payment(phone = "111111111") {
      const response = await fetch(
        `https://api.mercadopago.com/platforms/pci/yape/v1/payment?public_key=${encodeURIComponent(env.MERCADOPAGO_PUBLIC_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: phone,
            otp: "123456",
            requestId: randomUUID(),
          }),
        },
      );
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(typeof data.id).toBe("string");
      return {
        payment_method_id: "yape",
        phone_number: phone,
        token: data.id,
        amount: 1,
        total_amount: "0.01",
      };
    }
    async function pay(s: any, body: any) {
      const response = await fetch(
        `${base}/api/payments/mercadopago/sessions/${s.id}/pay`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${s.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          `Checkout HTTP ${response.status}: ${data.code || data.error}`,
        );
      let checkout = data.checkout;
      // A decline can be HTTP 402 before Orders search indexes the resource.
      // Wait for the canonical GET/worker; never create a second attempt here.
      for (
        let n = 0;
        n < 30 && ["processing", "paid"].includes(checkout.status);
        n++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const status = await fetch(
          `${base}/api/payments/mercadopago/sessions/${s.id}`,
          { headers: { Authorization: `Bearer ${s.token}` } },
        );
        if (status.ok) checkout = (await status.json()).checkout;
      }
      return checkout;
    }
    async function canonical(s: any) {
      const a = check(
        await db
          .from("mp_payment_attempts")
          .select("*")
          .eq("session_id", s.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
      );
      const response = await fetch(
        `https://api.mercadopago.com/v1/orders/${a.order_id}`,
        {
          headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` },
        },
      );
      expect(response.ok).toBe(true);
      return { attempt: a, order: await response.json() };
    }
    async function tickets(s: any) {
      return check(
        await db
          .from("tickets")
          .select("id,qr_token,is_active")
          .eq("mp_checkout_session_id", s.id),
      );
    }
    async function assertQr(s: any) {
      const issued = await tickets(s);
      expect(issued).toHaveLength(1);
      expect(issued[0].is_active).toBe(true);
      const response = await fetch(`${base}/ticket/${issued[0].id}`);
      expect(response.ok).toBe(true);
      const html = await response.text();
      const image =
        html.match(
          /src="(data:image\/png;base64,[^"]+)"[^>]*alt="QR de entrada"/,
        ) ||
        html.match(
          /alt="QR de entrada"[^>]*src="(data:image\/png;base64,[^"]+)"/,
        );
      expect(Boolean(image)).toBe(true);
      const { createRequire } = await import("node:module");
      const require = createRequire(import.meta.url);
      const {
        PNG,
      } = require("../../../node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs");
      const {
        MultiFormatReader,
        BinaryBitmap,
        HybridBinarizer,
        RGBLuminanceSource,
      } = require("../../../node_modules/.pnpm/@zxing+library@0.21.3/node_modules/@zxing/library/cjs");
      const png = PNG.sync.read(Buffer.from(image![1].split(",")[1], "base64"));
      const lum = new Uint8ClampedArray(png.width * png.height);
      for (let i = 0; i < lum.length; i++)
        lum[i] =
          (png.data[i * 4] + 2 * png.data[i * 4 + 1] + png.data[i * 4 + 2]) / 4;
      const decoded = new MultiFormatReader()
        .decode(
          new BinaryBitmap(
            new HybridBinarizer(
              new RGBLuminanceSource(lum, png.width, png.height),
            ),
          ),
        )
        .getText();
      expect(decoded === issued[0].qr_token).toBe(true);
      return issued[0].id;
    }
    async function webhook(orderId: string, valid = true) {
      const requestId = randomUUID(),
        ts = String(Date.now());
      const signature = createHmac("sha256", env.MERCADOPAGO_WEBHOOK_SECRET)
        .update(`id:${orderId.toLowerCase()};request-id:${requestId};ts:${ts};`)
        .digest("hex");
      return fetch(
        `${base}/api/payments/mercadopago/webhook?data.id=${orderId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-id": requestId,
            "x-signature": `ts=${ts},v1=${valid ? signature : "0".repeat(64)}`,
          },
          body: JSON.stringify({
            type: "order",
            action: "order.processed",
            live_mode: true,
            data: { id: orderId, version: 1 },
          }),
        },
      );
    }
    it("confirms a ticket via the sandbox API; duplicate submits and signed webhook replays keep one QR", async () => {
      const s = await fixture();
      const p = await payment();
      const state = await pay(s, p);
      expect(state.status).toBe("fulfilled");
      expect(state.amountCents).toBe(4000);
      const { order } = await canonical(s);
      expect(order.status).toBe("processed");
      expect(order.transactions.payments[0].payment_method.id).toBe("yape");
      expect(order.total_paid_amount).toBe("40.00");
      expect((await pay(s, p)).buyerTicketId).toBe(state.buyerTicketId);
      expect((await webhook(order.id, false)).status).toBe(401);
      for (let n = 0; n < 2; n++)
        expect((await webhook(order.id)).ok).toBe(true);
      expect(
        check(
          await db
            .from("mp_payment_attempts")
            .select("id")
            .eq("session_id", s.id),
        ),
      ).toHaveLength(1);
      expect(await assertQr(s)).toBe(state.buyerTicketId);
      const worker = await fetch(`${base}/api/payments/mercadopago/reconcile`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.MERCADOPAGO_WORKER_SECRET}` },
      });
      expect(worker.ok).toBe(true);
      expect(
        check(
          await db
            .from("mp_notification_jobs")
            .select("status")
            .eq("session_id", s.id)
            .single(),
        ).status,
      ).toBe("sent");
    }, 90000);
    it("does not issue on insufficient funds; a new approved Yape token fulfills the same ticket reservation", async () => {
      const s = await fixture();
      const failed = await pay(s, await payment("111111113"));
      expect(failed.status).toBe("awaiting_payment");
      expect(failed.paymentDetail).toBe("insufficient_amount");
      expect(await tickets(s)).toHaveLength(0);
      const accepted = await pay(s, await payment());
      expect(accepted.status).toBe("fulfilled");
      expect(accepted.amountCents).toBe(4000);
      expect(accepted.quantity).toBe(1);
      const { order } = await canonical(s);
      expect(order.total_paid_amount).toBe("40.00");
      expect((await webhook(order.id)).ok).toBe(true);
      expect(await assertQr(s)).toBe(accepted.buyerTicketId);
      const units = check(
        await db
          .from("ticket_reservation_units")
          .select("id,status,ticket_id")
          .eq("reservation_id", s.reservation_id),
      );
      expect(units).toHaveLength(1);
      expect(units.filter((u: any) => u.ticket_id)).toHaveLength(1);
      expect(
        check(
          await db
            .from("codes")
            .select("id")
            .eq("table_reservation_id", s.reservation_id),
        ),
      ).toHaveLength(1);
      expect(
        check(
          await db
            .from("mp_payment_attempts")
            .select("id")
            .eq("session_id", s.id),
        ),
      ).toHaveLength(2);
    }, 90000);
    it("pays a S/600 box with Yape, confirms the webhook and issues only the buyer QR", async () => {
      const s = await fixture(true);
      const headers = {
        Authorization: `Bearer ${s.token}`,
        "Content-Type": "application/json",
      };
      const endpoint = `${base}/api/payments/mercadopago/sessions/${s.id}`;
      const info = await (await fetch(endpoint, { headers })).json();
      expect(info.checkout.paymentMethods).toEqual(["card", "yape"]);
      const accepted = await pay(s, await payment());
      expect(accepted.status).toBe("fulfilled");
      expect(accepted.amountCents).toBe(60000);
      const { order } = await canonical(s);
      expect(order.total_paid_amount).toBe("600.00");
      expect((await webhook(order.id)).ok).toBe(true);
      expect(await assertQr(s)).toBe(accepted.buyerTicketId);
      expect(
        check(
          await db
            .from("table_reservations")
            .select("status")
            .eq("id", s.reservation_id)
            .single(),
        ).status,
      ).toBe("approved");
      expect(
        check(
          await db
            .from("payments")
            .select("status")
            .eq("reservation_id", s.reservation_id)
            .single(),
        ).status,
      ).toBe("paid");
      const units = check(
        await db
          .from("ticket_reservation_units")
          .select("status,ticket_id")
          .eq("reservation_id", s.reservation_id),
      );
      expect(units).toHaveLength(4);
      expect(
        units.filter((u: any) => u.status === "pending_nomination"),
      ).toHaveLength(3);
      expect(
        check(
          await db
            .from("mp_payment_attempts")
            .select("id")
            .eq("session_id", s.id),
        ),
      ).toHaveLength(1);
    }, 90000);
  },
);
