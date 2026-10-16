// Independent webhook proof: never calls BABY /pay, session GET or the worker.
// Run with the worker stopped, and keep the new checkout URL closed until verify.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseEnv } from "node:util";
import { randomBytes, randomUUID, createHash, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const action = process.argv[2] || "status";
const runFile = ".local/yape-webhook-run.json";
const env = parseEnv(await readFile("apps/landing/.env.local", "utf8"));
if (
  env.MERCADOPAGO_ENVIRONMENT !== "test" ||
  new URL(env.SUPABASE_URL).hostname !== "127.0.0.1" ||
  env.VERCEL_ENV ||
  env.BABY_EMAIL_TRANSPORT !== "mailpit"
)
  throw new Error("Loopback Supabase, test credentials and Mailpit required");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const headers = {
  Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
  "Content-Type": "application/json",
};
function check(r) {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
async function save(run) {
  await mkdir(".local", { recursive: true });
  await writeFile(runFile, JSON.stringify(run, null, 2));
}
if (action === "prepare") {
  const me = await (
    await fetch("https://api.mercadopago.com/users/me", { headers })
  ).json();
  if (
    !me.tags?.includes("test_user") ||
    String(me.id) !== env.MERCADOPAGO_COLLECTOR_ID
  )
    throw new Error("Sandbox merchant required");
  const seed = check(
    await db
      .from("events")
      .select("*")
      .eq("id", "20000000-0000-4000-8000-000000000001")
      .single(),
  );
  const eventId = randomUUID();
  check(
    await db
      .from("events")
      .insert({
        ...seed,
        id: eventId,
        name: "QA Yape webhook automático",
        capacity: 50,
      }),
  );
  const run = { eventId, preparedAt: new Date().toISOString(), purchases: [] };
  for (const [kind, quantity, amountCents, phone] of [
    ["entrada", 1, 4000, "111111111"],
    ["entrada-doble", 2, 8000, "111111111"],
    ["rechazo", 1, 4000, "111111113"],
  ]) {
    const reservationId = randomUUID(),
      token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const email = `qa.yape.${reservationId}@testuser.com`;
    check(
      await db
        .from("table_reservations")
        .insert({
          id: reservationId,
          event_id: eventId,
          sale_origin: "ticket",
          table_id: null,
          full_name: "QA Yape Automático " + kind,
          email,
          doc_type: "dni",
          document: String(97000000 + run.purchases.length),
          status: "pending",
          ticket_quantity: quantity,
          total_ticket_units: quantity,
          online_checkout_key: randomUUID(),
          online_checkout_token_hash: tokenHash,
          online_amount_cents: amountCents,
          online_checkout_expires_at: new Date(
            Date.now() + 1200000,
          ).toISOString(),
        }),
    );
    const session = check(
      await db.rpc("mp_open_checkout", {
        p_reservation: reservationId,
        p_token_hash: tokenHash,
        p_environment: "test",
        p_collector: env.MERCADOPAGO_COLLECTOR_ID,
        p_application: env.MERCADOPAGO_TEST_APPLICATION_ID,
      }),
    );
    const claim = check(
      await db.rpc("mp_claim_attempt", {
        p_session: session.id,
        p_request_hash: createHash("sha256").update(randomUUID()).digest("hex"),
      }),
    );
    if (claim.action !== "submit") throw new Error("Fresh attempt required");
    run.purchases.push({
      kind,
      quantity,
      amountCents,
      phone,
      email,
      reservationId,
      sessionId: session.id,
      token,
      attemptId: claim.attempt.id,
    });
  }
  await save(run);
  console.log(
    JSON.stringify({
      prepared: true,
      purchases: run.purchases.length,
      eventId,
    }),
  );
} else {
  const run = JSON.parse(await readFile(runFile, "utf8"));
  if (action === "create") {
    // Must be explicitly armed once; never create a replacement order on retry.
    if (run.creationStartedAt)
      throw new Error(
        "Orders already started; inspect status, never charge again",
      );
    run.creationStartedAt = new Date().toISOString();
    await save(run);
    for (const p of run.purchases) {
      const tokenResponse = await fetch(
        `https://api.mercadopago.com/platforms/pci/yape/v1/payment?public_key=${encodeURIComponent(env.MERCADOPAGO_PUBLIC_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: p.phone,
            otp: "123456",
            requestId: randomUUID(),
          }),
        },
      );
      const token = await tokenResponse.json();
      if (!tokenResponse.ok || !token.id)
        throw new Error("Sandbox Yape token rejected");
      const amount = (p.amountCents / 100).toFixed(2);
      const response = await fetch("https://api.mercadopago.com/v1/orders", {
        method: "POST",
        headers: { ...headers, "X-Idempotency-Key": p.attemptId },
        body: JSON.stringify({
          type: "online",
          processing_mode: "automatic",
          external_reference: p.attemptId,
          total_amount: amount,
          payer: {
            email: p.email,
            entity_type: "individual",
            phone: { area_code: "51", number: p.phone },
          },
          transactions: {
            payments: [
              {
                amount,
                payment_method: {
                  id: "yape",
                  type: "debit_card",
                  token: token.id,
                },
              },
            ],
          },
        }),
      });
      const order = await response.json();
      p.providerHttp = response.status;
      p.orderId = typeof order.id === "string" ? order.id : null;
      p.providerStatus = order.status || null;
      p.createdAt = new Date().toISOString();
      await save(run);
      console.log(
        JSON.stringify({
          kind: p.kind,
          providerHttp: response.status,
          providerStatus: p.providerStatus,
          hasOrderId: !!p.orderId,
        }),
      );
    }
  } else if (action === "replay") {
    // Export the original visible JSON body from the provider's delivery detail
    // to this private file. Re-sign it locally; do not pretend these are new
    // spontaneous provider deliveries.
    const body = JSON.parse(
      await readFile(".local/yape-original-event.json", "utf8"),
    );
    if (!run.purchases.some((p) => p.orderId === body.data?.id))
      throw new Error("Run event required");
    const id = body.data.id,
      requestId = randomUUID(),
      ts = String(Date.now());
    const signature = createHmac("sha256", env.MERCADOPAGO_WEBHOOK_SECRET)
      .update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`)
      .digest("hex");
    const call = (valid = true) =>
      fetch(
        `http://127.0.0.1:3004/api/payments/mercadopago/webhook?data.id=${id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-id": requestId,
            "x-signature": `ts=${ts},v1=${valid ? signature : "0".repeat(64)}`,
          },
          body: JSON.stringify(body),
        },
      );
    const results = await Promise.all(Array.from({ length: 5 }, () => call()));
    const duplicated = await Promise.all(
      results.map(
        async (r) => r.status === 200 && (await r.json()).duplicated === true,
      ),
    );
    const invalidStatus = (await call(false)).status;
    if (!duplicated.every(Boolean) || invalidStatus !== 401)
      throw new Error("Webhook replay guard failed");
    run.replayProof = {
      signedLocalReplays: 5,
      allDuplicated: true,
      alteredSignatureHttp: invalidStatus,
    };
    await save(run);
    console.log(JSON.stringify(run.replayProof));
  } else if (action === "nominate") {
    const p = run.purchases.find((p) => p.kind === "entrada-doble");
    if (!p?.proof?.webhookProcessed || p.proof.sessionStatus !== "fulfilled")
      throw new Error("Verify webhook proof first");
    const unit = check(
      await db
        .from("ticket_reservation_units")
        .select("id,status,ticket_id")
        .eq("reservation_id", p.reservationId)
        .eq("unit_index", 2)
        .single(),
    );
    const base = `http://127.0.0.1:3004/api/ticket-reservations/${p.reservationId}/units`;
    if (!unit.ticket_id) {
      const nominated = await fetch(base, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          units: [
            {
              id: unit.id,
              full_name: "QA Acompañante Yape",
              doc_type: "dni",
              document: "97999999",
              email: `qa.companion.${run.eventId}@testuser.com`,
              phone: "",
            },
          ],
        }),
      });
      if (!nominated.ok) throw new Error(`Nomination HTTP ${nominated.status}`);
    }
    for (let n = 0; n < 2; n++) {
      const issued = await fetch(`${base}/${unit.id}/issue`, {
        method: "POST",
      });
      if (!issued.ok) throw new Error(`Issue HTTP ${issued.status}`);
    }
    const issuedUnits = check(
      await db
        .from("ticket_reservation_units")
        .select("ticket_id,status")
        .eq("reservation_id", p.reservationId),
    );
    const attempts = check(
      await db
        .from("mp_payment_attempts")
        .select("id")
        .eq("session_id", p.sessionId),
    );
    if (
      new Set(issuedUnits.map((u) => u.ticket_id)).size !== 2 ||
      issuedUnits.some((u) => !u.ticket_id || u.status !== "issued") ||
      attempts.length !== 1
    )
      throw new Error("Companion QR or payment duplicated");
    run.nominationProof = {
      issuedIndividualQrs: 2,
      paymentAttempts: attempts.length,
      repeatedIssueSafe: true,
    };
    await save(run);
    console.log(JSON.stringify(run.nominationProof));
  } else if (action === "qrs") {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const {
      PNG,
    } = require("../../node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs");
    const {
      MultiFormatReader,
      BinaryBitmap,
      HybridBinarizer,
      RGBLuminanceSource,
    } = require("../../node_modules/.pnpm/@zxing+library@0.21.3/node_modules/@zxing/library/cjs");
    const decoded = new Set();
    for (const p of run.purchases.filter((p) => p.kind !== "rechazo")) {
      if (!p.proof?.webhookProcessed || p.proof.sessionStatus !== "fulfilled")
        throw new Error("Verify independent webhook proof first");
      const tickets = check(
        await db
          .from("tickets")
          .select("id,qr_token,is_active")
          .eq("table_reservation_id", p.reservationId),
      );
      for (const [index, ticket] of tickets.entries()) {
        const response = await fetch(
          `http://127.0.0.1:3004/ticket/${ticket.id}`,
        );
        const html = await response.text();
        const image =
          html.match(
            /src="(data:image\/png;base64,[^"]+)"[^>]*alt="QR de entrada"/,
          ) ||
          html.match(
            /alt="QR de entrada"[^>]*src="(data:image\/png;base64,[^"]+)"/,
          );
        if (!response.ok || !image || !ticket.is_active)
          throw new Error("Active rendered QR required");
        const bytes = Buffer.from(image[1].split(",")[1], "base64");
        const png = PNG.sync.read(bytes),
          lum = new Uint8ClampedArray(png.width * png.height);
        for (let i = 0; i < lum.length; i++)
          lum[i] =
            (png.data[i * 4] + 2 * png.data[i * 4 + 1] + png.data[i * 4 + 2]) /
            4;
        const text = new MultiFormatReader()
          .decode(
            new BinaryBitmap(
              new HybridBinarizer(
                new RGBLuminanceSource(lum, png.width, png.height),
              ),
            ),
          )
          .getText();
        if (text !== ticket.qr_token || decoded.has(text))
          throw new Error("QR mismatch or duplicate");
        decoded.add(text);
        await mkdir(".local/yape-webhook-evidence", { recursive: true });
        await writeFile(
          `.local/yape-webhook-evidence/${p.kind}-${index + 1}.png`,
          bytes,
        );
        console.log(
          JSON.stringify({
            kind: p.kind,
            unit: index + 1,
            active: true,
            decoded: true,
            matchesStoredTicket: true,
            width: png.width,
            height: png.height,
          }),
        );
      }
    }
    run.qrProof = {
      distinctDecodedQrs: decoded.size,
      verifiedAt: new Date().toISOString(),
    };
    await save(run);
    console.log(JSON.stringify(run.qrProof));
  } else if (["status", "verify"].includes(action)) {
    let complete = true;
    for (const p of run.purchases) {
      const session = check(
        await db
          .from("mp_checkout_sessions")
          .select("status,fulfilled_at")
          .eq("id", p.sessionId)
          .single(),
      );
      const attempt = check(
        await db
          .from("mp_payment_attempts")
          .select("status,order_id,provider_status_detail")
          .eq("id", p.attemptId)
          .single(),
      );
      p.orderId = attempt.order_id || p.orderId;
      const tickets = check(
        await db
          .from("tickets")
          .select("id,qr_token,is_active")
          .eq("mp_checkout_session_id", p.sessionId),
      );
      const events = attempt.order_id
        ? check(
            await db
              .from("mp_webhook_events")
              .select("status,received_at,processed_at")
              .eq("order_id", attempt.order_id),
          )
        : [];
      const expectedQrCount =
        p.kind === "entrada-doble" && run.nominationProof ? p.quantity : 1;
      const expected =
        p.kind === "rechazo"
          ? session.status === "awaiting_payment" &&
            attempt.status === "failed" &&
            tickets.length === 0
          : session.status === "fulfilled" &&
            tickets.length === expectedQrCount &&
            tickets.every((t) => t.is_active);
      const webhookProcessed = events.some((e) => e.status === "processed");
      complete &&= expected && webhookProcessed;
      p.proof = {
        sessionStatus: session.status,
        attemptStatus: attempt.status,
        detail: attempt.provider_status_detail,
        qrCount: tickets.length,
        webhookProcessed,
        events,
      };
      if (tickets.length) p.ticketId = tickets[0].id;
      console.log(JSON.stringify({ kind: p.kind, ...p.proof }));
    }
    await save(run);
    if (action === "verify" && !complete)
      throw new Error(
        "Independent automatic webhook proof incomplete; do not run worker/session GET to mask it",
      );
    if (complete)
      console.log(
        JSON.stringify({
          independentWebhookProof: true,
          purchases: run.purchases.length,
        }),
      );
  } else throw new Error("Use prepare, create, status or verify");
}
