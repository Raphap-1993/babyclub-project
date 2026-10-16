import assert from "node:assert/strict";
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
} from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

// This harness must never touch a remote database or send real mail.
const env = parseEnv(await readFile("apps/landing/.env.local", "utf8"));
const base = new URL(process.env.CUSTOMER_TEST_URL || "http://127.0.0.1:3004");
const mail = new URL(env.MAILPIT_URL || "http://127.0.0.1:64324");
const local = (value) =>
  ["localhost", "127.0.0.1"].includes(new URL(value).hostname);
assert(
  local(base) &&
    local(mail) &&
    local(env.SUPABASE_URL) &&
    env.BABY_EMAIL_TRANSPORT === "mailpit",
  "Local database, app and Mailpit required",
);
assert(
  /^[a-f0-9]{64}$/.test(env.CUSTOMER_ACCESS_SECRET || ""),
  "Local customer secret required",
);
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const hash = (value) => createHash("sha256").update(value).digest("hex");
const keyed = (scope, value) =>
  createHmac("sha256", Buffer.from(env.CUSTOMER_ACCESS_SECRET, "hex"))
    .update(`${scope}:${value}`)
    .digest("hex");
const run = randomUUID();
const dni = "0" + String(randomInt(1_000_000, 9_999_999));
const guestDni = "9" + dni.slice(1);
const email = `customer.dni.${run}@example.com`;
const tracked = [];
const challengeIds = [];
const tokenHashes = [];
const checks = [];
const require = createRequire(import.meta.url);
const { BinaryBitmap, HybridBinarizer, RGBLuminanceSource, MultiFormatReader } =
  createRequire(require.resolve("@zxing/browser"))("@zxing/library");
const sharp = createRequire(require.resolve("next"))("sharp");
const keep = process.argv.includes("--keep");
let passed = false;
async function insert(table, row) {
  const result = await db.from(table).insert(row).select("*").single();
  if (result.error) throw new Error(`${table}: ${result.error.message}`);
  tracked.push([table, result.data.id]);
  return result.data;
}
function acceptCookies(jar, response) {
  for (const header of response.headers.getSetCookie()) {
    const [part] = header.split(";");
    const index = part.indexOf("=");
    const name = part.slice(0, index),
      value = decodeURIComponent(part.slice(index + 1));
    if (value) jar.set(name, value);
    else jar.delete(name);
  }
}
async function http(jar, body) {
  const cookie = [...jar]
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
  const response = await fetch(new URL("/api/customer-access", base), {
    method: body ? "POST" : "GET",
    headers: {
      Origin: base.origin,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  acceptCookies(jar, response);
  return { response, payload };
}
async function rpc(name, args) {
  const result = await db.rpc(name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
async function createChallenge() {
  const id = randomUUID(),
    scope = randomUUID();
  challengeIds.push(id);
  assert.equal(
    await rpc("create_customer_access_challenge", {
      p_id: id,
      p_document_hash: hash(scope),
      p_ip_hash: hash("ip:" + scope),
      p_binding_hash: "bound",
      p_code_hash: "correct",
    }),
    true,
  );
  const updated = await db
    .from("customer_access_challenges")
    .update({ identity_encrypted: "synthetic-encrypted-identity" })
    .eq("id", id);
  assert.equal(updated.error, null);
  return id;
}
async function claim(id, code = "correct", binding = "bound") {
  const tokenHash = hash(randomBytes(32));
  tokenHashes.push(tokenHash);
  return rpc("verify_customer_access_challenge", {
    p_id: id,
    p_binding_hash: binding,
    p_code_hash: code,
    p_token_hash: tokenHash,
  });
}

try {
  const person = await insert("persons", {
    first_name: "Cliente",
    last_name: "Prueba local DNI",
    dni,
    document: dni,
    doc_type: "dni",
  });
  const guest = await insert("persons", {
    first_name: "Invitado",
    last_name: "Prueba local",
    dni: guestDni,
    document: guestDni,
    doc_type: "dni",
  });
  const dates = [-72, 48, 216];
  const events = [];
  const tickets = [];
  for (let i = 0; i < dates.length; i++) {
    const event = await insert("events", {
      name: `LOCAL DNI ${i === 0 ? "pasado" : i === 1 ? "próximo" : "posterior"}`,
      starts_at: new Date(Date.now() + dates[i] * 3_600_000).toISOString(),
      is_active: true,
      location: "Entorno de pruebas · BABY",
    });
    events.push(event);
    const code = await insert("codes", {
      code: `LOCAL-DNI-${randomUUID()}`,
      event_id: event.id,
      type: "general",
      is_active: true,
      max_uses: 100,
    });
    tickets.push(
      await insert("tickets", {
        event_id: event.id,
        code_id: code.id,
        person_id: person.id,
        qr_token: `LOCAL-DNI-${randomUUID()}`,
        full_name: "Cliente Prueba local",
        email,
        doc_type: "dni",
        document: dni,
        dni,
        is_active: true,
        payment_status: "paid",
      }),
    );
    if (i === 1)
      await insert("tickets", {
        event_id: event.id,
        code_id: code.id,
        person_id: guest.id,
        qr_token: `LOCAL-GUEST-${randomUUID()}`,
        full_name: "Invitado Prueba local",
        email,
        doc_type: "dni",
        document: guestDni,
        dni: guestDni,
        is_active: true,
        payment_status: "paid",
      });
  }
  const table = (
    await db.from("tables").select("id").is("deleted_at", null).limit(1)
  ).data?.[0];
  const reservation = await insert("table_reservations", {
    event_id: events[1].id,
    full_name: "Cliente Prueba local",
    email,
    doc_type: "dni",
    document: dni,
    status: "approved",
    sale_origin: table ? "table" : "ticket",
    table_id: table?.id || null,
  });
  const jar = new Map();
  assert.equal((await http(jar)).response.status, 401);
  assert.equal(
    (await http(jar, { action: "lookup", dni: "bad" })).response.status,
    400,
  );
  const lookup = await http(jar, { action: "lookup", dni });
  assert.equal(lookup.response.status, 202);
  assert(!JSON.stringify(lookup.payload).includes(email));
  assert(!JSON.stringify(lookup.payload).includes(dni));
  assert.match(lookup.response.headers.get("set-cookie"), /HttpOnly/);
  const originalChallenge = jar.get("baby_access_challenge");
  let otp;
  let firstMailId;
  for (let attempt = 0; attempt < 40 && !otp; attempt++) {
    const inbox = await (await fetch(new URL("/api/v1/messages", mail))).json();
    const message = inbox.messages?.find(
      (message) =>
        message.Subject === "Tu código para acceder a BABY" &&
        message.To?.some((recipient) => recipient.Address === email),
    );
    if (message) {
      firstMailId = message.ID;
      const content = await (
        await fetch(new URL(`/api/v1/message/${message.ID}`, mail))
      ).json();
      otp = content.Text.match(/\b\d{6}\b/)?.[0];
    }
    if (!otp) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(otp, "Mailpit must receive the OTP; it is never printed");
  checks.push("DNI → código enviado solo al correo registrado en Mailpit");
  const wrong = otp === "000000" ? "111111" : "000000";
  assert.equal(
    (await http(jar, { action: "verify", code: wrong, remember: true }))
      .response.status,
    401,
  );
  const otherBrowser = new Map();
  assert.equal(
    (await http(otherBrowser, { action: "verify", code: otp, remember: true }))
      .response.status,
    400,
  );
  const verified = await http(jar, {
    action: "verify",
    code: otp,
    remember: true,
  });
  assert.equal(verified.response.status, 200);
  assert.match(verified.response.headers.get("set-cookie"), /Max-Age=2592000/);
  const sessionToken = jar.get("baby_access"),
    oldJar = new Map(jar);
  assert(sessionToken);
  tokenHashes.push(hash(sessionToken));
  const wallet = await http(jar);
  assert.equal(wallet.response.status, 200);
  assert.equal(wallet.payload.wallet.event.name, events[1].name);
  assert.deepEqual(
    wallet.payload.wallet.tickets.map((ticket) => ticket.id),
    [tickets[1].id],
  );
  assert.match(wallet.payload.wallet.tickets[0].qr, /^data:image\/png;base64,/);
  const decodedImage = await sharp(
    Buffer.from(wallet.payload.wallet.tickets[0].qr.split(",")[1], "base64"),
  )
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bitmap = new BinaryBitmap(
    new HybridBinarizer(
      new RGBLuminanceSource(
        new Uint8ClampedArray(decodedImage.data),
        decodedImage.info.width,
        decodedImage.info.height,
      ),
    ),
  );
  assert.equal(
    new MultiFormatReader().decode(bitmap).getText(),
    tickets[1].qr_token,
  );
  assert.equal(wallet.payload.wallet.reservations[0].id, reservation.id);
  assert.match(wallet.response.headers.get("cache-control"), /no-store/);
  checks.push(
    "QR propio del próximo evento; fuera pasado, evento posterior e invitado con otro DNI",
  );
  assert.equal(
    (await http(jar, { action: "lookup", dni })).payload.verified,
    true,
  );
  const rememberedInbox = await (
    await fetch(new URL("/api/v1/messages", mail))
  ).json();
  assert.equal(
    rememberedInbox.messages.filter(
      (message) =>
        message.Subject === "Tu código para acceder a BABY" &&
        message.To?.some((recipient) => recipient.Address === email),
    ).length,
    1,
    "Remembered devices must not request another verification email",
  );
  assert.equal((await http(new Map())).response.status, 401);
  const replay = new Map([["baby_access_challenge", originalChallenge]]);
  assert.equal(
    (await http(replay, { action: "verify", code: otp, remember: true }))
      .response.status,
    401,
  );
  checks.push(
    "Dispositivo recordado sin otro correo; dispositivo nuevo y código reutilizado rechazados",
  );
  await db.from("tickets").update({ used: true }).eq("id", tickets[1].id);
  const used = await http(jar);
  assert.equal(used.payload.wallet.tickets[0].qr, null);
  assert.equal(used.payload.wallet.tickets[0].state, "used");
  await db.from("tickets").update({ used: false }).eq("id", tickets[1].id);
  const expiredToken = randomBytes(32).toString("hex");
  tokenHashes.push(hash(expiredToken));
  const currentSession = await db
    .from("customer_access_devices")
    .select("identity_encrypted")
    .eq("token_hash", hash(sessionToken))
    .single();
  const expired = await db.from("customer_access_devices").insert({
    token_hash: hash(expiredToken),
    identity_encrypted: currentSession.data.identity_encrypted,
    expires_at: new Date(Date.now() - 1000).toISOString(),
  });
  assert.equal(expired.error, null);
  assert.equal(
    (await http(new Map([["baby_access", expiredToken]]))).response.status,
    401,
  );
  await http(jar, { action: "logout" });
  assert.equal((await http(oldJar)).response.status, 401);
  checks.push(
    "Entrada utilizada no muestra QR; sesión vencida o cerrada no vuelve a acceder",
  );
  for (const event of events.slice(1)) {
    const result = await db
      .from("events")
      .update({ starts_at: new Date(Date.now() - 72 * 3600000).toISOString() })
      .eq("id", event.id);
    assert.equal(result.error, null);
  }
  const cooldown = await db
    .from("customer_access_challenges")
    .update({ created_at: new Date(Date.now() - 120000).toISOString() })
    .eq("document_hash", keyed("dni", dni));
  assert.equal(cooldown.error, null);
  const historicalJar = new Map();
  assert.equal(
    (await http(historicalJar, { action: "lookup", dni })).response.status,
    202,
  );
  let historicalOtp;
  for (let attempt = 0; attempt < 40 && !historicalOtp; attempt++) {
    const inbox = await (await fetch(new URL("/api/v1/messages", mail))).json();
    const message = inbox.messages?.find(
      (message) =>
        message.ID !== firstMailId &&
        message.Subject === "Tu código para acceder a BABY" &&
        message.To?.some((recipient) => recipient.Address === email),
    );
    if (message) {
      const content = await (
        await fetch(new URL("/api/v1/message/" + message.ID, mail))
      ).json();
      historicalOtp = content.Text.match(/\b\d{6}\b/)?.[0];
    }
    if (!historicalOtp)
      await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(historicalOtp, "Past-only customer must receive a new OTP in Mailpit");
  assert.equal(
    (
      await http(historicalJar, {
        action: "verify",
        code: historicalOtp,
        remember: true,
      })
    ).response.status,
    200,
  );
  tokenHashes.push(hash(historicalJar.get("baby_access")));
  const historicalWallet = await http(historicalJar);
  assert.equal(historicalWallet.response.status, 200);
  assert.deepEqual(historicalWallet.payload.wallet, {
    event: null,
    tickets: [],
    reservations: [],
  });
  await http(historicalJar, { action: "logout" });
  for (const event of events.slice(1)) {
    const result = await db
      .from("events")
      .update({ starts_at: event.starts_at })
      .eq("id", event.id);
    assert.equal(result.error, null);
  }
  checks.push(
    "Cliente solo con historial recibe código; cartera vacía sin QR pasados",
  );
  const race = await createChallenge();
  const raceResults = await Promise.all([claim(race), claim(race)]);
  assert.equal(raceResults.filter(Boolean).length, 1);
  const locked = await createChallenge();
  for (let i = 0; i < 5; i++) assert.equal(await claim(locked, "wrong"), null);
  assert.equal(await claim(locked), null);
  const expiredChallenge = await createChallenge();
  await db
    .from("customer_access_challenges")
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq("id", expiredChallenge);
  assert.equal(await claim(expiredChallenge), null);
  const binding = await createChallenge();
  assert.equal(await claim(binding, "correct", "other-browser"), null);
  checks.push(
    "PostgreSQL real: un solo uso concurrente, cinco intentos, expiración y vínculo al navegador",
  );
  const throttleId = randomUUID(),
    throttleDocument = hash(randomUUID()),
    throttleIp = hash(randomUUID());
  challengeIds.push(throttleId);
  const args = {
    p_id: throttleId,
    p_document_hash: throttleDocument,
    p_ip_hash: throttleIp,
    p_binding_hash: "b",
    p_code_hash: "c",
  };
  assert.equal(await rpc("create_customer_access_challenge", args), true);
  assert.equal(
    await rpc("create_customer_access_challenge", {
      ...args,
      p_id: randomUUID(),
    }),
    false,
  );
  for (let i = 0; i < 2; i++) {
    await db
      .from("customer_access_challenges")
      .update({ created_at: new Date(Date.now() - 120_000).toISOString() })
      .eq("document_hash", throttleDocument);
    const id = randomUUID();
    challengeIds.push(id);
    assert.equal(
      await rpc("create_customer_access_challenge", { ...args, p_id: id }),
      true,
    );
  }
  await db
    .from("customer_access_challenges")
    .update({ created_at: new Date(Date.now() - 120_000).toISOString() })
    .eq("document_hash", throttleDocument);
  assert.equal(
    await rpc("create_customer_access_challenge", {
      ...args,
      p_id: randomUUID(),
    }),
    false,
  );
  checks.push("Límites persistentes de 60 segundos y tres códigos por hora");
  const anon = createClient(
    env.SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  assert((await anon.from("customer_access_devices").select("*")).error);
  assert(
    (
      await anon.rpc("verify_customer_access_challenge", {
        p_id: race,
        p_binding_hash: "bound",
        p_code_hash: "correct",
        p_token_hash: hash("anon"),
      })
    ).error,
  );
  checks.push("Tablas y funciones de acceso inaccesibles para anon");
  passed = true;
  if (keep) {
    await mkdir(".local", { recursive: true });
    await writeFile(
      ".local/customer-access-qa.json",
      JSON.stringify(
        { dni, email, eventName: events[1].name, eventId: events[1].id },
        null,
        2,
      ),
    );
  }
  console.log(
    JSON.stringify(
      { passed: checks.length, checks, fixturesKept: keep },
      null,
      2,
    ),
  );
} finally {
  // Only IDs created by this run, all within the verified local database.
  await db
    .from("customer_access_challenges")
    .delete()
    .eq("document_hash", keyed("dni", dni));
  if (challengeIds.length)
    await db.from("customer_access_challenges").delete().in("id", challengeIds);
  if (tokenHashes.length)
    await db
      .from("customer_access_devices")
      .delete()
      .in("token_hash", tokenHashes);
  if (!keep || !passed)
    for (const [table, id] of tracked.reverse()) {
      const result = await db.from(table).delete().eq("id", id);
      if (result.error)
        console.error(`Could not remove local fixture from ${table}`);
    }
}
