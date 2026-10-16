import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
const env = parseEnv(await readFile("apps/backoffice/.env.local", "utf8"));
const base = new URL(
  process.env.BACKOFFICE_TEST_URL || "http://localhost:3000",
);
const loopback = (value) =>
  ["localhost", "127.0.0.1"].includes(new URL(value).hostname);
assert(
  loopback(base) && loopback(env.SUPABASE_URL),
  "Local app and database required",
);
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const ticketResult = await db
  .from("tickets")
  .select("id,email,qr_token")
  .like("email", "%@example.com")
  .is("deleted_at", null)
  .order("created_at", { ascending: false })
  .limit(1)
  .single();
const reservationResult = await db
  .from("table_reservations")
  .select("email")
  .like("email", "%@example.com")
  .is("deleted_at", null)
  .order("created_at", { ascending: false })
  .limit(1)
  .single();
assert(
  !ticketResult.error && !reservationResult.error,
  "Synthetic local fixtures required",
);
const ticket = ticketResult.data;
const forbidden = [
  ticket.email,
  ticket.qr_token,
  reservationResult.data.email,
].filter(Boolean);
const checks = [];
for (const path of [
  "/admin/reservations",
  "/admin/tickets",
  `/admin/tickets/${ticket.id}`,
]) {
  for (const rsc of [false, true]) {
    const response = await fetch(new URL(path, base), {
      headers: rsc ? { RSC: "1" } : {},
      cache: "no-store",
    });
    assert.equal(response.status, 200);
    const body = await response.text();
    assert(
      !forbidden.some((value) => body.includes(value)),
      "Anonymous response must not contain customer or QR data",
    );
    checks.push({
      screen: path.startsWith("/admin/tickets/") ? "ticket_detail" : path,
      rsc,
      dataAbsent: true,
    });
  }
}
for (const view of ["reservations", "tickets", "ticket"]) {
  const response = await fetch(
    new URL(`/api/admin/sales-view?view=${view}`, base),
  );
  assert.equal(response.status, 401);
  assert.match(response.headers.get("cache-control"), /no-store/);
}
console.log(
  JSON.stringify(
    { checks, anonymousApiDenied: true, productionTouched: false },
    null,
    2,
  ),
);
