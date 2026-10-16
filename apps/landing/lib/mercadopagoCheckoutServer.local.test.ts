import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { hashCheckoutToken } from "shared/payments/mercadopagoConfig";
import {
  applyMercadoPagoCanonicalOrder,
  authorizeMercadoPagoCheckout,
  fulfillMercadoPagoCheckout,
  notifyMercadoPagoCheckout,
  openMercadoPagoCheckout,
  processMercadoPagoWebhook,
  readMercadoPagoCheckout,
  submitMercadoPagoPayment,
} from "./mercadopagoCheckoutServer";
import { ensureTicketOnlyBuyerIssued } from "../../backoffice/app/api/reservations/ticketOnlyFlow";

// Opt-in integration suite. It creates synthetic records ONLY in loopback Supabase.
describe.runIf(process.env.BABY_MP_LOCAL_TESTS === "1")(
  "Mercado Pago / isolated local database",
  () => {
    let db: any;
    let anon: any;
    let eventId: string;
    let tableId: string;
    const realFetch = globalThis.fetch;
    const sessions: any[] = [];
    beforeAll(async () => {
      const env = parseEnv(
        readFileSync("apps/landing/.env.local", "utf8"),
      ) as Record<string, string>;
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(
          new URL(env.SUPABASE_URL).hostname,
        )
      )
        throw new Error("Local database required");
      for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
      db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      anon = createClient(
        env.SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY,
      );
      const seed = await db
        .from("events")
        .select("*")
        .eq("id", "20000000-0000-4000-8000-000000000001")
        .single();
      eventId = randomUUID();
      const event = {
        ...seed.data,
        id: eventId,
        name: "QA MP aislado " + eventId.slice(0, 8),
        capacity: 20,
        created_at: new Date().toISOString(),
      };
      check(await db.from("events").insert(event));
      const table = await db
        .from("tables")
        .select("*")
        .eq("id", "10ef9ed0-9933-4cca-ad8a-4f12d695b4d5")
        .single();
      tableId = randomUUID();
      check(
        await db.from("tables").insert({
          ...table.data,
          id: tableId,
          event_id: eventId,
          name: "QA MP",
        }),
      );
    });
    afterEach(() => vi.stubGlobal("fetch", realFetch));
    afterAll(async () => {
      if (db && eventId) {
        const now = new Date().toISOString();
        await db
          .from("tickets")
          .update({ is_active: false, deleted_at: now })
          .eq("event_id", eventId);
        await db
          .from("codes")
          .update({ is_active: false, deleted_at: now })
          .eq("event_id", eventId);
        await db
          .from("table_reservations")
          .update({ status: "rejected", deleted_at: now })
          .eq("event_id", eventId);
        await db
          .from("tables")
          .update({ is_active: false, deleted_at: now })
          .eq("id", tableId);
        await db
          .from("events")
          .update({ is_active: false, deleted_at: now })
          .eq("id", eventId);
        for (const s of sessions)
          await db
            .from("mp_payment_attempts")
            .update({ status: "review" })
            .eq("session_id", s.id)
            .in("status", ["creating", "unknown", "pending"]);
        for (const s of sessions) {
          const attempts = await db
            .from("mp_payment_attempts")
            .select("order_id")
            .eq("session_id", s.id);
          for (const a of attempts.data || [])
            if (a.order_id)
              await db
                .from("mp_webhook_events")
                .update({ status: "ignored" })
                .eq("order_id", a.order_id)
                .in("status", ["received", "error"]);
        }
      }
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });
    function check(result: any) {
      if (result.error) throw new Error(result.error.message);
      return result.data;
    }
    async function fixture(
      quantity = 1,
      table = false,
      selectedTableId = tableId,
    ) {
      const token = randomBytes(32).toString("hex");
      const reservationId = randomUUID();
      check(
        await db.from("table_reservations").insert({
          id: reservationId,
          event_id: eventId,
          table_id: table ? selectedTableId : null,
          full_name: "QA Pago " + reservationId.slice(0, 8),
          email: `qa.${reservationId}@example.com`,
          phone: null,
          doc_type: "dni",
          document: String(90000000 + sessions.length),
          sale_origin: table ? "table" : "ticket",
          status: "pending",
          ticket_quantity: quantity,
          total_ticket_units: quantity,
          online_checkout_key: randomUUID(),
          online_checkout_token_hash: hashCheckoutToken(token),
          online_amount_cents: 4000,
          online_checkout_expires_at: new Date(
            Date.now() + 1200000,
          ).toISOString(),
        }),
      );
      const opened = await openMercadoPagoCheckout(db, reservationId, token);
      const session = check(
        await db
          .from("mp_checkout_sessions")
          .select("*")
          .eq("id", opened.checkoutId)
          .single(),
      );
      const s = { ...session, token };
      sessions.push(s);
      return s;
    }
    async function claim(s: any, fingerprint = "a".repeat(64)) {
      return check(
        await db.rpc("mp_claim_attempt", {
          p_session: s.id,
          p_request_hash: fingerprint,
        }),
      );
    }
    function order(s: any, a: any, status = "paid") {
      return {
        id: "ORDLOCAL" + a.id.replaceAll("-", ""),
        type: "online",
        status:
          status === "paid"
            ? "processed"
            : status === "pending"
              ? "processing"
              : status === "refunded"
                ? "refunded"
                : "failed",
        status_detail: status === "paid" ? "accredited" : "pending",
        external_reference: a.id,
        country_code: "PER",
        user_id: s.collector_id,
        integration_data: { application_id: s.application_id },
        total_amount: "40.00",
        total_paid_amount: status === "paid" ? "40.00" : "0.00",
        transactions: {
          payments: [
            {
              id: "PAYLOCAL" + a.id,
              status: status === "paid" ? "processed" : "processing",
              status_detail: status === "paid" ? "accredited" : "pending",
              amount: "40.00",
              paid_amount: status === "paid" ? "40.00" : "0.00",
            },
          ],
        },
      };
    }
    it("keeps session details and RPCs inaccessible to anonymous clients", async () => {
      const s = await fixture();
      await expect(
        authorizeMercadoPagoCheckout(db, s.id, "Bearer " + "b".repeat(64)),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        (await anon.from("mp_checkout_sessions").select("*")).error,
      ).toBeTruthy();
      for (const table of [
        "payments",
        "payment_webhook_events",
        "ticket_reservation_units",
      ]) {
        expect(
          (await anon.from(table).select("*").limit(1)).error,
        ).toBeTruthy();
      }
      check(
        await db
          .from("mp_checkout_sessions")
          .update({ environment: "live" })
          .eq("id", s.id),
      );
      await expect(
        authorizeMercadoPagoCheckout(db, s.id, "Bearer " + s.token),
      ).rejects.toMatchObject({ status: 409 });
      check(
        await db
          .from("mp_checkout_sessions")
          .update({ environment: "test" })
          .eq("id", s.id),
      );
      expect(
        (
          await anon.rpc("mp_claim_attempt", {
            p_session: s.id,
            p_request_hash: "b".repeat(64),
          })
        ).error,
      ).toBeTruthy();
      await fulfillMercadoPagoCheckout(db, s.id);
      expect(
        check(
          await db
            .from("tickets")
            .select("id")
            .eq("mp_checkout_session_id", s.id),
        ),
      ).toHaveLength(0);
      const reservation = check(
        await db
          .from("table_reservations")
          .select("*")
          .eq("id", s.reservation_id)
          .single(),
      );
      await expect(
        ensureTicketOnlyBuyerIssued({
          supabase: db,
          reservation,
          reservationId: reservation.id,
          eventId,
          ticketQuantity: 1,
        }),
      ).rejects.toThrow("online_payment_not_accredited");
    });
    it("pauses new tickets, tables and attempts, while existing approvals still issue exactly one QR", async () => {
      const role = check(
        await db.from("staff_roles").select("id").eq("code", "admin").single(),
      );
      const staff = check(
        await db
          .from("staff")
          .select("id")
          .eq("staff_role_id", role.id)
          .eq("is_active", true)
          .is("deleted_at", null)
          .limit(1)
          .single(),
      );
      const readControl = async () =>
        check(
          await db.from("mp_sales_control").select("*").eq("id", true).single(),
        );
      const original = await readControl();
      if (original.paused)
        throw new Error("Resume local sales before running this suite");
      const extraTableId = randomUUID();
      const tableRow = check(
        await db.from("tables").select("*").eq("id", tableId).single(),
      );
      check(await db.from("tables").insert({ ...tableRow, id: extraTableId }));
      const ticket = await fixture();
      const table = await fixture(1, true, extraTableId);
      const unopened = await fixture();
      const ticketAttempt = (await claim(ticket)).attempt;
      const tableAttempt = (await claim(table)).attempt;
      await applyMercadoPagoCanonicalOrder(
        db,
        ticketAttempt,
        order(ticket, ticketAttempt, "pending"),
      );
      await applyMercadoPagoCanonicalOrder(
        db,
        tableAttempt,
        order(table, tableAttempt, "pending"),
      );
      try {
        // A role key cannot bypass the audited procedure via direct writes.
        expect(
          (
            await db
              .from("mp_sales_control")
              .update({ paused: true })
              .eq("id", true)
          ).error,
        ).toBeTruthy();
        expect(
          (await anon.from("mp_sales_control").select("*")).error,
        ).toBeTruthy();
        expect(
          (
            await anon.rpc("mp_set_sales_paused", {
              p_paused: true,
              p_version: original.version,
              p_staff: staff.id,
            })
          ).error,
        ).toBeTruthy();
        expect(
          (
            await db.rpc("mp_set_sales_paused", {
              p_paused: true,
              p_version: original.version,
              p_staff: randomUUID(),
            })
          ).error?.message,
        ).toContain("sales_control_forbidden");
        const contenders = await Promise.all(
          [1, 2].map(() =>
            db.rpc("mp_set_sales_paused", {
              p_paused: true,
              p_version: original.version,
              p_staff: staff.id,
            }),
          ),
        );
        expect(contenders.filter((result) => !result.error)).toHaveLength(1);
        expect(
          contenders.find((result) => result.error)?.error.message,
        ).toContain("sales_control_conflict");
        const paused = await readControl();
        expect(paused).toMatchObject({
          paused: true,
          version: original.version + 1,
          updated_by: staff.id,
        });
        check(
          await db.rpc("mp_set_sales_paused", {
            p_paused: true,
            p_version: paused.version,
            p_staff: staff.id,
          }),
        );
        expect((await readControl()).version).toBe(paused.version);
        expect(
          check(
            await db
              .from("mp_sales_control_audit")
              .select("id")
              .eq("version", paused.version),
          ),
        ).toHaveLength(1);
        await expect(fixture()).rejects.toThrow("mercadopago_sales_paused");
        await expect(fixture(1, true)).rejects.toThrow(
          "mercadopago_sales_paused",
        );
        await expect(claim(unopened)).rejects.toThrow(
          "mercadopago_sales_paused",
        );
        await expect(
          submitMercadoPagoPayment(db, unopened, {
            payment_method_id: "yape",
            phone_number: "111111111",
            token: "synthetic-yape-token",
          }),
        ).rejects.toMatchObject({ code: "mercadopago_sales_paused" });
        expect(
          check(
            await db
              .from("mp_payment_attempts")
              .select("id")
              .eq("session_id", unopened.id),
          ),
        ).toHaveLength(0);
        expect((await claim(ticket)).action).toBe("reconcile");
        for (const [session, attempt] of [
          [ticket, ticketAttempt],
          [table, tableAttempt],
        ]) {
          await applyMercadoPagoCanonicalOrder(
            db,
            attempt,
            order(session, attempt),
          );
          await applyMercadoPagoCanonicalOrder(
            db,
            attempt,
            order(session, attempt),
          );
          expect(
            (await readMercadoPagoCheckout(db, session, false)).status,
          ).toBe("fulfilled");
          const issued = check(
            await db
              .from("tickets")
              .select("id,qr_token,is_active")
              .eq("mp_checkout_session_id", session.id),
          );
          expect(issued).toHaveLength(1);
          expect(issued[0].qr_token).toBeTruthy();
          expect(issued[0].is_active).toBe(true);
        }
      } finally {
        const latest = await readControl();
        check(
          await db.rpc("mp_set_sales_paused", {
            p_paused: false,
            p_version: latest.version,
            p_staff: staff.id,
          }),
        );
        check(
          await db
            .from("tables")
            .update({ is_active: false, deleted_at: new Date().toISOString() })
            .eq("id", extraTableId),
        );
      }
      expect((await claim(unopened)).action).toBe("submit");
    }, 30000);
    it("keeps a 3DS hold without QR, recovers its challenge, then fulfills only canonical approval", async () => {
      const s = await fixture();
      const a = (await claim(s)).attempt;
      const challenge = order(s, a, "pending");
      challenge.status = "action_required";
      challenge.status_detail = "pending_challenge";
      Object.assign(challenge.transactions.payments[0], {
        status: "action_required",
        status_detail: "pending_challenge",
        payment_method: {
          transaction_security: {
            url: "https://www.mercadopago.com.pe/auth/card/validation/pages/remedies/qa-3ds?guest_token=synthetic",
          },
        },
      });
      await applyMercadoPagoCanonicalOrder(db, a, challenge);
      const pending = await readMercadoPagoCheckout(db, s, false);
      expect(pending.status).toBe("processing");
      expect(pending.buyerTicketId).toBeNull();
      expect(pending.challenge?.url).toContain("/qa-3ds?");
      expect((await claim(s)).action).toBe("reconcile");
      // The normal twenty-minute hold must not release an unresolved challenge.
      check(
        await db
          .from("mp_checkout_sessions")
          .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
          .eq("id", s.id),
      );
      check(await db.rpc("mp_expire_checkouts"));
      expect((await readMercadoPagoCheckout(db, s, false)).status).toBe(
        "processing",
      );
      await applyMercadoPagoCanonicalOrder(db, a, order(s, a));
      const paid = await readMercadoPagoCheckout(db, s, false);
      expect(paid.status).toBe("fulfilled");
      expect(paid.challenge).toBeNull();
      expect(paid.buyerTicketId).toBeTruthy();
      await applyMercadoPagoCanonicalOrder(db, a, challenge); // stale notification
      expect(
        (await readMercadoPagoCheckout(db, s, false)).challenge,
      ).toBeNull();
    });
    it("releases a rejected or expired 3DS attempt without issuing a QR", async () => {
      for (const state of ["failed", "canceled"]) {
        const s = await fixture();
        const a = (await claim(s)).attempt;
        const rejected = order(s, a, "failed");
        rejected.status = state;
        rejected.status_detail =
          state === "failed" ? "cc_rejected_3ds_challenge" : "expired";
        await applyMercadoPagoCanonicalOrder(db, a, rejected);
        const result = await readMercadoPagoCheckout(db, s, false);
        expect(result.buyerTicketId).toBeNull();
        expect(result.challenge).toBeNull();
        expect(result.paymentDetail).toBe(rejected.status_detail);
        expect((await claim(s)).action).toBe("submit");
      }
    });
    it("serializes attempts and reuses the same key after an unknown result", async () => {
      const s = await fixture();
      const one = await claim(s);
      expect(one.action).toBe("submit");
      expect((await claim(s)).action).toBe("busy");
      check(
        await db
          .from("mp_payment_attempts")
          .update({ status: "unknown" })
          .eq("id", one.attempt.id),
      );
      expect((await claim(s)).attempt.id).toBe(one.attempt.id);
      check(
        await db
          .from("mp_payment_attempts")
          .update({ status: "unknown" })
          .eq("id", one.attempt.id),
      );
      expect(
        (
          await db.rpc("mp_claim_attempt", {
            p_session: s.id,
            p_request_hash: "c".repeat(64),
          })
        ).error?.message,
      ).toContain("payment_result_unknown");
    });
    it("never approves a canonical order with the wrong amount or collector", async () => {
      const s = await fixture();
      const a = (await claim(s)).attempt;
      const mismatched = { ...order(s, a), total_amount: "0.01" };
      await applyMercadoPagoCanonicalOrder(db, a, mismatched);
      expect(
        check(
          await db
            .from("mp_checkout_sessions")
            .select("status")
            .eq("id", s.id)
            .single(),
        ).status,
      ).toBe("review");
      expect(
        check(
          await db
            .from("tickets")
            .select("id")
            .eq("mp_checkout_session_id", s.id),
        ),
      ).toHaveLength(0);
    });
    it("reserves a table once under concurrent requests and enforces capacity", async () => {
      const contenders = await Promise.allSettled([
        fixture(1, true),
        fixture(1, true),
      ]);
      expect(contenders.filter((r) => r.status === "fulfilled")).toHaveLength(
        1,
      );
      expect(contenders.filter((r) => r.status === "rejected")).toHaveLength(1);
      await expect(fixture(30)).rejects.toThrow("event_capacity_exceeded");
    });
    it("blocks a second checkout for the same buyer before a second charge", async () => {
      const s = await fixture();
      const row = check(
        await db
          .from("table_reservations")
          .select("*")
          .eq("id", s.reservation_id)
          .single(),
      );
      const duplicate = await db.from("table_reservations").insert({
        ...row,
        id: randomUUID(),
        online_checkout_key: randomUUID(),
        online_checkout_token_hash: randomBytes(32).toString("hex"),
      });
      expect(duplicate.error?.message).toContain("reservation_buyer_active");
    });
    it("expires abandoned checkout holds but keeps unknown payment attempts reserved", async () => {
      const abandoned = await fixture();
      const pending = await fixture();
      const a = (await claim(pending)).attempt;
      check(
        await db
          .from("mp_payment_attempts")
          .update({ status: "unknown" })
          .eq("id", a.id),
      );
      const past = new Date(Date.now() - 60000).toISOString();
      for (const s of [abandoned, pending]) {
        check(
          await db
            .from("table_reservations")
            .update({ online_checkout_expires_at: past })
            .eq("id", s.reservation_id),
        );
        check(
          await db
            .from("mp_checkout_sessions")
            .update({ expires_at: past })
            .eq("id", s.id),
        );
      }
      expect(
        (
          await readMercadoPagoCheckout(
            db,
            { ...abandoned, expires_at: past },
            false,
          )
        ).status,
      ).toBe("expired");
      check(await db.rpc("mp_expire_checkouts"));
      expect(
        check(
          await db
            .from("mp_checkout_sessions")
            .select("status")
            .eq("id", abandoned.id)
            .single(),
        ).status,
      ).toBe("expired");
      expect(
        check(
          await db
            .from("table_reservations")
            .select("status")
            .eq("id", pending.reservation_id)
            .single(),
        ).status,
      ).toBe("pending");
    });
    it("uses the canonical API for signed webhooks, emits one QR, repairs binding and revokes refunds", async () => {
      const s = await fixture(2);
      const a = (await claim(s)).attempt;
      let canonical = order(s, a, "pending");
      const canonicalRequestUrls: string[] = [];
      vi.stubGlobal("fetch", async (input: any, init: any) => {
        if (
          String(input).startsWith("https://api.mercadopago.com/v1/orders/")
        ) {
          canonicalRequestUrls.push(String(input));
          return Response.json(canonical);
        }
        return realFetch(input, init);
      });
      const body: any = {
        type: "order",
        live_mode: true,
        action: "order.processed",
        date_created: new Date().toISOString(),
        data: {
          id: canonical.id,
          version: 1,
          status: "processed",
          status_detail: "accredited",
          total_paid_amount: "40.00",
        },
      };
      const requestId = randomUUID(),
        ts = String(Date.now());
      const signature = createHmac(
        "sha256",
        process.env.MERCADOPAGO_WEBHOOK_SECRET!,
      )
        .update(
          `id:${canonical.id.toLowerCase()};request-id:${requestId};ts:${ts};`,
        )
        .digest("hex");
      const input = {
        body,
        headers: new Headers({
          "x-request-id": requestId,
          "x-signature": `ts=${ts},v1=${signature}`,
        }),
        search: new URLSearchParams({ "data.id": canonical.id }),
      };
      await expect(
        processMercadoPagoWebhook(db, { ...input, headers: new Headers() }),
      ).rejects.toMatchObject({ status: 401 });
      const uppercaseSignature = createHmac(
        "sha256",
        process.env.MERCADOPAGO_WEBHOOK_SECRET!,
      )
        .update(`id:${canonical.id};request-id:${requestId};ts:${ts};`)
        .digest("hex");
      await expect(
        processMercadoPagoWebhook(db, {
          ...input,
          headers: new Headers({
            "x-request-id": requestId,
            "x-signature": `ts=${ts},v1=${uppercaseSignature}`,
          }),
        }),
      ).rejects.toMatchObject({ code: "webhook_signature_invalid" });
      await expect(
        processMercadoPagoWebhook(db, {
          ...input,
          body: {
            ...body,
            data: { ...body.data, id: canonical.id.toLowerCase() },
          },
        }),
      ).rejects.toMatchObject({ code: "webhook_envelope_invalid" });
      await processMercadoPagoWebhook(db, input);
      expect(canonicalRequestUrls).toEqual([
        `https://api.mercadopago.com/v1/orders/${canonical.id}`,
      ]);
      expect(
        check(
          await db
            .from("mp_checkout_sessions")
            .select("status")
            .eq("id", s.id)
            .single(),
        ).status,
      ).toBe("processing");
      expect(
        check(
          await db
            .from("tickets")
            .select("id")
            .eq("mp_checkout_session_id", s.id),
        ),
      ).toHaveLength(0);
      canonical = order(s, a);
      body.data.version = 2;
      await Promise.all([
        processMercadoPagoWebhook(db, input),
        processMercadoPagoWebhook(db, input),
      ]);
      await fulfillMercadoPagoCheckout(db, s.id);
      const tickets = check(
        await db
          .from("tickets")
          .select("id,qr_token,person_id")
          .eq("mp_checkout_session_id", s.id),
      );
      expect(tickets).toHaveLength(1);
      expect(tickets[0].qr_token).toBeTruthy();
      expect(
        check(
          await db
            .from("ticket_reservation_units")
            .select("id")
            .eq("reservation_id", s.reservation_id),
        ),
      ).toHaveLength(2);
      expect(
        check(
          await db
            .from("codes")
            .select("id")
            .eq("table_reservation_id", s.reservation_id),
        ),
      ).toHaveLength(2);
      // Recover a crash after the ticket insert but before unit binding.
      check(
        await db
          .from("mp_checkout_sessions")
          .update({ status: "paid" })
          .eq("id", s.id),
      );
      check(
        await db
          .from("ticket_reservation_units")
          .update({ ticket_id: null, status: "pending_nomination" })
          .eq("reservation_id", s.reservation_id)
          .eq("unit_index", 1),
      );
      await fulfillMercadoPagoCheckout(db, s.id);
      expect(
        check(
          await db
            .from("ticket_reservation_units")
            .select("ticket_id")
            .eq("reservation_id", s.reservation_id)
            .eq("unit_index", 1)
            .single(),
        ).ticket_id,
      ).toBe(tickets[0].id);
      await notifyMercadoPagoCheckout(db, s.id);
      await notifyMercadoPagoCheckout(db, s.id);
      expect(
        check(
          await db
            .from("mp_notification_jobs")
            .select("status,attempts")
            .eq("session_id", s.id)
            .single(),
        ),
      ).toMatchObject({ status: "sent", attempts: 1 });
      canonical = order(s, a, "refunded");
      body.data.version = 3;
      await processMercadoPagoWebhook(db, input);
      expect(
        check(
          await db
            .from("tickets")
            .select("is_active")
            .eq("id", tickets[0].id)
            .single(),
        ).is_active,
      ).toBe(false);
      expect(
        (
          await db
            .from("tickets")
            .update({ is_active: true })
            .eq("id", tickets[0].id)
        ).error?.message,
      ).toContain("online_payment_not_accredited");
      // A delayed accreditation must not resurrect a refunded QR.
      canonical = order(s, a);
      body.data.version = 4;
      await processMercadoPagoWebhook(db, input);
      expect(
        check(
          await db
            .from("mp_checkout_sessions")
            .select("status")
            .eq("id", s.id)
            .single(),
        ).status,
      ).toBe("refunded");
    }, 30000);
  },
);
