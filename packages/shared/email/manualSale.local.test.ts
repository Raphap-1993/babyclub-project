import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { notifyManualSale, retryManualSaleEmails } from "./manualSale";

describe.runIf(process.env.BABY_MANUAL_EMAIL_LOCAL_TESTS === "1")(
  "manual sales / local email and QR",
  () => {
    let db: any, anon: any, staff: any;
    const eventId = randomUUID(),
      tableId = randomUUID(),
      productId = randomUUID();
    const documents: string[] = [];
    const realFetch = globalThis.fetch;
    function check(r: any) {
      if (r.error) throw new Error(r.error.message);
      return r.data;
    }
    beforeAll(async () => {
      const env = parseEnv(readFileSync("apps/landing/.env.local", "utf8"));
      if (
        !["127.0.0.1", "localhost"].includes(new URL(env.SUPABASE_URL).hostname)
      )
        throw new Error("Local database required");
      for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
      vi.stubEnv("BABY_EMAIL_TRANSPORT", "mailpit");
      vi.stubEnv("MAILPIT_URL", "http://127.0.0.1:64324");
      db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      anon = createClient(env.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      staff = check(
        await db
          .from("staff")
          .select("id,role:staff_roles(code)")
          .eq("is_active", true)
          .is("deleted_at", null),
      ).find(
        (s: any) =>
          (Array.isArray(s.role) ? s.role[0] : s.role)?.code?.toLowerCase() ===
          "admin",
      );
      const seed = check(
        await db
          .from("events")
          .select("*")
          .eq("id", "20000000-0000-4000-8000-000000000001")
          .single(),
      );
      check(
        await db
          .from("events")
          .insert({
            ...seed,
            id: eventId,
            name: "QA correo manual",
            capacity: 100,
            is_active: true,
            closed_at: null,
            force_closed: false,
          }),
      );
      check(
        await db
          .from("event_ticket_types")
          .insert({
            event_id: eventId,
            code: "manual_mail",
            label: "Entrada QA",
            price: 25,
            ticket_quantity: 2,
            sale_phase: "all_night",
            is_active: true,
          }),
      );
      check(
        await db
          .from("tables")
          .insert({
            id: tableId,
            event_id: eventId,
            organizer_id: seed.organizer_id,
            name: "BOX correo QA",
            ticket_count: 8,
            price: 600,
            is_active: true,
          }),
      );
      check(
        await db
          .from("table_products")
          .insert({
            id: productId,
            table_id: tableId,
            name: "Pack QA",
            price: 600,
            tickets_included: 8,
            is_active: true,
          }),
      );
    });
    afterEach(() => vi.stubGlobal("fetch", realFetch));
    afterAll(async () => {
      if (!db) return;
      const own = check(
        await db.from("payments").select("id").eq("event_id", eventId),
      );
      if (own.length)
        check(
          await db
            .from("manual_sale_email_jobs")
            .delete()
            .in(
              "payment_id",
              own.map((p: any) => p.id),
            ),
        );
      for (const table of [
        "ticket_reservation_units",
        "payments",
        "tickets",
        "codes",
        "table_reservations",
      ])
        check(await db.from(table).delete().eq("event_id", eventId));
      check(await db.from("table_products").delete().eq("id", productId));
      check(await db.from("tables").delete().eq("id", tableId));
      check(
        await db.from("event_ticket_types").delete().eq("event_id", eventId),
      );
      check(await db.from("events").delete().eq("id", eventId));
      if (documents.length)
        check(await db.from("persons").delete().in("document", documents));
      vi.unstubAllEnvs();
    });
    async function sell(kind: string) {
      const document = "QA" + randomUUID().replaceAll("-", "").slice(0, 10);
      documents.push(document);
      const paymentId = randomUUID();
      const result = check(
        await db.rpc("record_manual_sale", {
          p_request: paymentId,
          p_staff: staff.id,
          p_payload: {
            event_id: eventId,
            table_id: kind === "box" ? tableId : null,
            product_id: kind === "box" ? productId : null,
            ticket_type_code: kind === "box" ? null : "manual_mail",
            package_quantity: 1,
            expected_amount_cents: kind === "box" ? 60000 : 2500,
            full_name: "Cliente QA " + kind,
            email: `${document}@example.com`,
            doc_type: "pasaporte",
            document,
            phone: "999000000",
            payment_method: "yape",
            reference: "QA-" + paymentId,
            received: true,
          },
        }),
      );
      return result;
    }
    it.each(["entrada", "box"])(
      "%s queda pagada/aprobada y recibe un solo correo con su QR válido",
      async (kind) => {
        const sale = await sell(kind);
        expect(
          check(
            await db
              .from("table_reservations")
              .select("status")
              .eq("id", sale.reservationId)
              .single(),
          ).status,
        ).toBe("approved");
        expect(
          check(
            await db
              .from("payments")
              .select("status")
              .eq("id", sale.paymentId)
              .single(),
          ).status,
        ).toBe("paid");
        const ticket = check(
          await db
            .from("tickets")
            .select("qr_token,payment_status")
            .eq("id", sale.ticketId)
            .single(),
        );
        expect(ticket.payment_status).toBe("paid");
        const outcomes = await Promise.all([
          notifyManualSale(db, sale.paymentId),
          notifyManualSale(db, sale.paymentId),
        ]);
        expect(outcomes).toContain("sent");
        const job = check(
          await db
            .from("manual_sale_email_jobs")
            .select("*")
            .eq("payment_id", sale.paymentId)
            .single(),
        );
        expect(job.status).toBe("sent");
        expect(job.attempts).toBe(1);
        expect(await notifyManualSale(db, sale.paymentId)).toBe("sent");
        const message = await (
          await realFetch(
            `http://127.0.0.1:64324/api/v1/message/${job.provider_message_id}`,
          )
        ).json();
        expect(message.HTML).toContain("Compra pagada y aprobada");
        expect(message.HTML).toContain(`/ticket/${sale.ticketId}`);
        expect(message.HTML).toContain(`reservationId=${sale.reservationId}`);
        expect(message.HTML).not.toContain("quickchart");
        const image = [
          ...(message.Inline || []),
          ...(message.Attachments || []),
        ].find((a: any) => a.ContentID === "buyer-qr");
        expect(image).toBeTruthy();
        const bytes = Buffer.from(
          await (
            await realFetch(
              `http://127.0.0.1:64324/api/v1/message/${job.provider_message_id}/part/${image.PartID}`,
            )
          ).arrayBuffer(),
        );
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
        const png = PNG.sync.read(bytes),
          lum = new Uint8ClampedArray(png.width * png.height);
        for (let i = 0; i < lum.length; i++)
          lum[i] =
            (png.data[i * 4] + 2 * png.data[i * 4 + 1] + png.data[i * 4 + 2]) /
            4;
        expect(
          new MultiFormatReader()
            .decode(
              new BinaryBitmap(
                new HybridBinarizer(
                  new RGBLuminanceSource(lum, png.width, png.height),
                ),
              ),
            )
            .getText(),
        ).toBe(ticket.qr_token);
        writeFileSync(
          `.local/manual-email-${kind}.json`,
          JSON.stringify({
            messageId: job.provider_message_id,
            paid: true,
            approved: true,
            qrDecoded: true,
            duplicateEmails: 0,
          }),
        );
      },
    );
    it("recupera un envío fallido sin cambiar pago, reserva ni QR", async () => {
      const sale = await sell("entrada");
      vi.stubGlobal("fetch", (input: any, init: any) =>
        String(input).endsWith("/api/v1/send")
          ? Promise.reject(new Error("simulated outage"))
          : realFetch(input, init),
      );
      expect(await notifyManualSale(db, sale.paymentId)).toBe("pending");
      expect(
        check(
          await db
            .from("payments")
            .select("status")
            .eq("id", sale.paymentId)
            .single(),
        ).status,
      ).toBe("paid");
      vi.stubGlobal("fetch", realFetch);
      check(
        await db
          .from("manual_sale_email_jobs")
          .update({ locked_until: null })
          .eq("payment_id", sale.paymentId),
      );
      await retryManualSaleEmails(db);
      const job = check(
        await db
          .from("manual_sale_email_jobs")
          .select("status,attempts")
          .eq("payment_id", sale.paymentId)
          .single(),
      );
      expect(job).toMatchObject({ status: "sent", attempts: 2 });
    });
    it("no permite acceso público a la cola ni reclamar envíos", async () => {
      expect(
        (await anon.rpc("claim_manual_sale_email", { p_payment: randomUUID() }))
          .error,
      ).toBeTruthy();
      expect(
        (await anon.from("manual_sale_email_jobs").select("*")).error,
      ).toBeTruthy();
    });
  },
);
