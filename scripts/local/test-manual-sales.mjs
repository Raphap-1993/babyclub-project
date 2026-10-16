import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const env = parseEnv(await readFile("apps/landing/.env.local", "utf8"));
assert(
  ["localhost", "127.0.0.1"].includes(new URL(env.SUPABASE_URL).hostname),
  "Isolated local database required",
);
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anon = createClient(env.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const eventId = randomUUID(),
  tableId = randomUUID(),
  productId = randomUUID(),
  typeId = randomUUID();
const documents = [];
const checks = [];
function checked(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
const staff = checked(
  await db
    .from("staff")
    .select("id,staff_role_id,role:staff_roles(code)")
    .eq("is_active", true)
    .is("deleted_at", null),
).find(
  (row) =>
    (Array.isArray(row.role) ? row.role[0] : row.role)?.code?.toLowerCase() ===
    "admin",
);
assert(staff, "Local admin fixture required");
const originalRoleCode = (
  Array.isArray(staff.role) ? staff.role[0] : staff.role
).code;
function payload(overrides = {}) {
  const document = "QA" + randomUUID().replaceAll("-", "").slice(0, 10);
  documents.push(document);
  return {
    event_id: eventId,
    table_id: null,
    product_id: null,
    ticket_type_code: "manual_test",
    package_quantity: 1,
    expected_amount_cents: 4000,
    full_name: "Prueba Venta Manual",
    email: `manual.${document}@example.com`,
    phone: "999000000",
    doc_type: "pasaporte",
    document,
    payment_method: "cash",
    reference: "",
    notes: "LOCAL QA",
    received: true,
    ...overrides,
  };
}
async function sell(data, id = randomUUID()) {
  return db.rpc("record_manual_sale", {
    p_request: id,
    p_staff: staff.id,
    p_payload: data,
  });
}
try {
  checked(
    await db
      .from("staff_roles")
      .update({ code: "DOOR" })
      .eq("id", staff.staff_role_id),
  );
  assert.equal((await sell(payload())).error?.message, "manual_sale_forbidden");
  checks.push("El rol DOOR sigue sin permiso para registrar cobros manuales");
  // Reproduce the uppercase ADMIN role used in production without changing users there.
  checked(
    await db
      .from("staff_roles")
      .update({ code: "ADMIN" })
      .eq("id", staff.staff_role_id),
  );
  const seed = checked(
    await db
      .from("events")
      .select("*")
      .eq("id", "20000000-0000-4000-8000-000000000001")
      .single(),
  );
  checked(
    await db.from("events").insert({
      ...seed,
      id: eventId,
      name: "QA ventas manuales " + eventId.slice(0, 8),
      capacity: 20,
      is_active: true,
      closed_at: null,
      force_closed: false,
    }),
  );
  checked(
    await db.from("event_ticket_types").insert({
      id: typeId,
      event_id: eventId,
      code: "manual_test",
      label: "Pack dos QA",
      ticket_quantity: 2,
      price: 40,
      sale_phase: "all_night",
      is_active: true,
    }),
  );
  checked(
    await db.from("tables").insert({
      id: tableId,
      event_id: eventId,
      organizer_id: seed.organizer_id,
      name: "BOX QA",
      ticket_count: 8,
      price: 600,
      is_active: true,
    }),
  );
  checked(
    await db.from("table_products").insert({
      id: productId,
      table_id: tableId,
      name: "Pack QA",
      price: 600,
      tickets_included: 8,
      is_active: true,
    }),
  );
  const owner = payload(),
    request = randomUUID();
  const repeated = await Promise.all([
    sell(owner, request),
    sell(owner, request),
  ]);
  repeated.forEach(checked);
  assert.equal(repeated[0].data.reservationId, repeated[1].data.reservationId);
  assert.equal(repeated.filter((r) => r.data.replayed).length, 1);
  const reservation = checked(
    await db
      .from("table_reservations")
      .select("*")
      .eq("id", repeated[0].data.reservationId)
      .single(),
  );
  assert.equal(reservation.status, "approved");
  assert.equal(reservation.sale_origin, "ticket");
  assert.equal(reservation.total_ticket_units, 2);
  const paid = checked(
    await db.from("payments").select("*").eq("id", request).single(),
  );
  assert.equal(paid.status, "paid");
  assert.equal(paid.provider, "manual");
  assert.equal(paid.amount, 4000);
  assert.equal(paid.metadata.staff_id, staff.id);
  const buyerTicket = checked(
    await db.from("tickets").select("*").eq("id", paid.ticket_id).single(),
  );
  assert.equal(buyerTicket.payment_status, "paid");
  const units = checked(
    await db
      .from("ticket_reservation_units")
      .select("*")
      .eq("reservation_id", reservation.id),
  );
  assert.equal(units.length, 2);
  assert.equal(units.filter((u) => u.status === "issued").length, 1);
  checks.push(
    "Venta de entradas pagada, recibo, QR comprador y nominación preparados atómicamente; reintento concurrente sin duplicados",
  );
  const before = checked(
    await db.from("payments").select("id").eq("event_id", eventId),
  ).length;
  assert.equal(
    (await sell({ ...owner, full_name: "Otro nombre" }, request)).error
      ?.message,
    "manual_request_conflict",
  );
  assert.equal(
    (await sell(payload({ expected_amount_cents: 1 }))).error?.message,
    "sale_price_changed",
  );
  assert.equal(
    (await sell(payload({ received: false }))).error?.message,
    "manual_sale_invalid",
  );
  assert.equal((await sell(owner)).error?.message, "buyer_ticket_exists");
  assert.equal(
    checked(await db.from("payments").select("id").eq("event_id", eventId))
      .length,
    before,
  );
  const pendingBuyer = payload();
  const pending = {
    event_id: eventId,
    full_name: pendingBuyer.full_name,
    email: pendingBuyer.email,
    doc_type: pendingBuyer.doc_type,
    document: pendingBuyer.document,
    status: "pending",
    sale_origin: "ticket",
    online_checkout_key: randomUUID(),
    online_checkout_token_hash: "a".repeat(64),
    online_amount_cents: 4000,
    online_checkout_expires_at: new Date(Date.now() + 1200000).toISOString(),
  };
  checked(await db.from("table_reservations").insert(pending));
  assert.equal(
    (await sell(pendingBuyer)).error?.message,
    "buyer_checkout_exists",
  );
  assert.equal(
    (
      await db.from("table_reservations").insert({
        ...pending,
        email: owner.email,
        document: owner.document,
        online_checkout_key: randomUUID(),
      })
    ).error?.message,
    "buyer_manual_sale_exists",
  );
  checks.push(
    "Precio alterado, cobro no confirmado, identidad repetida y clave reutilizada con otros datos fallan sin escritura parcial",
  );
  const tablePayload = () =>
    payload({
      table_id: tableId,
      product_id: productId,
      ticket_type_code: null,
      expected_amount_cents: 60000,
      payment_method: "transfer",
      reference: "LOCAL-123",
    });
  const boxes = await Promise.all([sell(tablePayload()), sell(tablePayload())]);
  assert.equal(boxes.filter((r) => !r.error).length, 1);
  assert.equal(
    boxes.find((r) => r.error).error.message,
    "reservation_table_active",
  );
  const box = boxes.find((r) => !r.error).data;
  const boxReservation = checked(
    await db
      .from("table_reservations")
      .select("*")
      .eq("id", box.reservationId)
      .single(),
  );
  assert.equal(boxReservation.sale_origin, "table");
  assert.equal(boxReservation.ticket_quantity, 8);
  assert.equal(
    checked(
      await db
        .from("tickets")
        .select("payment_status")
        .eq("id", box.ticketId)
        .single(),
    ).payment_status,
    "paid",
  );
  assert(
    (
      await sell(
        payload({ payment_method: "transfer", reference: "local-123" }),
      )
    ).error?.message.includes("payments_manual_reference_uidx"),
  );
  checks.push(
    "Box con ocho accesos pagados; dos ventas concurrentes del mismo box producen solo una reserva",
  );
  const guest = payload();
  const person = checked(
    await db
      .from("persons")
      .insert({
        first_name: "Invitado",
        last_name: "QA",
        doc_type: "pasaporte",
        document: guest.document,
      })
      .select("id")
      .single(),
  );
  const code = checked(
    await db
      .from("codes")
      .select("id")
      .eq("table_reservation_id", reservation.id)
      .eq("person_index", 2)
      .single(),
  );
  const nomination = checked(
    await db
      .from("tickets")
      .insert({
        event_id: eventId,
        person_id: person.id,
        code_id: code.id,
        qr_token: randomUUID(),
        full_name: "Invitado QA",
        doc_type: "pasaporte",
        document: guest.document,
        payment_status: "pending",
      })
      .select("payment_status,table_reservation_id")
      .single(),
  );
  assert.equal(nomination.payment_status, "paid");
  assert.equal(nomination.table_reservation_id, reservation.id);
  const inviteCode = checked(
    await db
      .from("codes")
      .insert({
        code: "LOCAL-INV-" + randomUUID(),
        event_id: eventId,
        type: "courtesy",
        max_uses: 1,
      })
      .select("id")
      .single(),
  );
  const invite = checked(
    await db
      .from("tickets")
      .insert({
        event_id: eventId,
        person_id: person.id,
        code_id: inviteCode.id,
        qr_token: randomUUID(),
        full_name: "Invitado QA",
      })
      .select("payment_status,table_reservation_id")
      .single(),
  );
  assert.equal(invite.payment_status, null);
  assert.equal(invite.table_reservation_id, null);
  checks.push(
    "QR de acompañante hereda pago manual; invitación independiente conserva pago nulo y no se transforma en venta",
  );
  assert.equal(
    (
      await sell(
        payload({ package_quantity: 10, expected_amount_cents: 40000 }),
      )
    ).error?.message,
    "event_capacity_exceeded",
  );
  assert(
    (
      await anon.rpc("record_manual_sale", {
        p_request: randomUUID(),
        p_staff: staff.id,
        p_payload: payload(),
      })
    ).error,
  );
  checks.push("Capacidad protegida y RPC prohibida para acceso público");
  console.log(
    JSON.stringify(
      { passed: checks.length, checks, productionTouched: false },
      null,
      2,
    ),
  );
} finally {
  checked(
    await db
      .from("staff_roles")
      .update({ code: originalRoleCode })
      .eq("id", staff.staff_role_id),
  );
  // Delete only fixtures belonging to this isolated run.
  const ownPayments = checked(
    await db.from("payments").select("id").eq("event_id", eventId),
  );
  if (ownPayments.length)
    checked(
      await db
        .from("manual_sale_email_jobs")
        .delete()
        .in(
          "payment_id",
          ownPayments.map((p) => p.id),
        ),
    );
  checked(
    await db.from("ticket_reservation_units").delete().eq("event_id", eventId),
  );
  checked(await db.from("payments").delete().eq("event_id", eventId));
  checked(await db.from("tickets").delete().eq("event_id", eventId));
  checked(await db.from("codes").delete().eq("event_id", eventId));
  checked(await db.from("table_reservations").delete().eq("event_id", eventId));
  checked(await db.from("table_products").delete().eq("id", productId));
  checked(await db.from("tables").delete().eq("id", tableId));
  checked(await db.from("event_ticket_types").delete().eq("event_id", eventId));
  checked(await db.from("events").delete().eq("id", eventId));
  if (documents.length)
    checked(await db.from("persons").delete().in("document", documents));
}
