import { createHash } from "node:crypto";
import { isYapeReservationAllowed } from "shared/payments/mercadopagoYape";
import { safeMercadoPagoChallengeUrl } from "shared/payments/mercadopagoChallenge";
import {
  getMercadoPagoConfig,
  hashCheckoutToken,
} from "shared/payments/mercadopagoConfig";
import { PaymentServiceError } from "shared/payments/errors";
import {
  buildMercadoPagoCardOrder,
  createMercadoPagoCardOrder,
  buildMercadoPagoYapeOrder,
  createMercadoPagoYapeOrder,
  evaluateMercadoPagoOrder,
  getMercadoPagoOrder,
  findMercadoPagoOrder,
  type MercadoPagoCardOrderInput,
  type MercadoPagoYapeOrderInput,
} from "shared/payments/mercadopagoOrders";
import { ensureTicketOnlyBuyerIssued } from "../../backoffice/app/api/reservations/ticketOnlyFlow";
import { sendApprovalEmail } from "../../backoffice/app/api/reservations/email";
import { buildReservationUnits } from "shared/ticketReservationUnits";
import { ensureReservationUnitCodes } from "../app/api/ticket-reservations/lib/reservationUnitCodes";

type DB = any;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertCheckoutEnvironment(session: any) {
  const config = getMercadoPagoConfig();
  if (
    session.environment !== config.environment ||
    session.collector_id !== config.collectorId ||
    session.application_id !== config.applicationId
  ) {
    throw new PaymentServiceError(
      "El ambiente del pago no coincide con la compra",
      409,
    );
  }
}

function databaseError(error: any) {
  if (error)
    throw new PaymentServiceError(
      "No pudimos actualizar la compra. Conservamos tu intento para verificarlo.",
      503,
      "checkout_storage_error",
    );
}

export function checkoutDatabaseError(error: any) {
  if (/mercadopago_sales_paused/.test(error?.message || ""))
    return new PaymentServiceError(
      "La venta de entradas y mesas está pausada temporalmente. Tus compras anteriores siguen vigentes.",
      503,
      "mercadopago_sales_paused",
    );
  if (/reservation_buyer_active/.test(error?.message || ""))
    return new PaymentServiceError(
      "Ya tienes una compra en curso para este evento. Retoma tu enlace de pago o espera que venza antes de iniciar otra.",
      409,
    );
  if (/reservation_table_active/.test(error?.message || ""))
    return new PaymentServiceError(
      "La mesa ya tiene una reserva activa para este evento",
      409,
    );
  if (/event_capacity_exceeded/.test(error?.message || ""))
    return new PaymentServiceError(
      "El evento ya no tiene cupos suficientes",
      409,
    );
  if (/checkout_expired/.test(error?.message || ""))
    return new PaymentServiceError(
      "La sesión de compra venció. Vuelve a elegir tus entradas o mesa.",
      409,
    );
  if (/payment_result_unknown/.test(error?.message || ""))
    return new PaymentServiceError(
      "Tu pago se está verificando. No inicies otro cobro.",
      409,
      "payment_result_unknown",
    );
  if (/checkout_unavailable/.test(error?.message || ""))
    return new PaymentServiceError(
      "Esta compra requiere verificación. No vuelvas a pagar.",
      409,
    );
  return new PaymentServiceError(
    "No se pudo preparar la compra",
    503,
    "checkout_storage_error",
  );
}

export async function openMercadoPagoCheckout(
  db: DB,
  reservationId: string,
  token: string,
) {
  const config = getMercadoPagoConfig(true);
  const { data, error } = await db.rpc("mp_open_checkout", {
    p_reservation: reservationId,
    p_token_hash: hashCheckoutToken(token),
    p_environment: config.environment,
    p_collector: config.collectorId,
    p_application: config.applicationId,
  });
  if (error) throw checkoutDatabaseError(error);
  return {
    checkoutId: data.id,
    checkoutUrl: `/pago/${data.id}#token=${token}`,
  };
}

export async function recoverMercadoPagoCheckout(db: DB, body: any) {
  const { data, error } = await db
    .from("table_reservations")
    .select("id")
    .eq("online_checkout_key", body.checkout_request_id)
    .eq("online_checkout_token_hash", hashCheckoutToken(body.checkout_token))
    .is("deleted_at", null)
    .maybeSingle();
  databaseError(error);
  return data?.id
    ? {
        success: true,
        reservationId: data.id,
        ...(await openMercadoPagoCheckout(db, data.id, body.checkout_token)),
      }
    : null;
}

export async function authorizeMercadoPagoCheckout(
  db: DB,
  id: string,
  authorization: string | null,
) {
  getMercadoPagoConfig();
  const token = authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!uuid.test(id) || !token)
    throw new PaymentServiceError("No se encontró tu sesión de compra", 404);
  const { data, error } = await db
    .from("mp_checkout_sessions")
    .select("*")
    .eq("id", id)
    .eq("token_hash", hashCheckoutToken(token))
    .maybeSingle();
  databaseError(error);
  if (!data)
    throw new PaymentServiceError("No se encontró tu sesión de compra", 404);
  assertCheckoutEnvironment(data);
  return data;
}

export async function reconcileMercadoPagoAttempt(db: DB, attempt: any) {
  const config = getMercadoPagoConfig();
  databaseError(
    (
      await db
        .from("mp_payment_attempts")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", attempt.id)
    ).error,
  );
  const orderId =
    attempt.order_id ||
    (await findMercadoPagoOrder(
      attempt.id,
      attempt.created_at,
      config.accessToken,
    ));
  if (!orderId) return null;
  if (!attempt.order_id)
    databaseError(
      (
        await db
          .from("mp_payment_attempts")
          .update({ order_id: orderId })
          .eq("id", attempt.id)
      ).error,
    );
  const order = await getMercadoPagoOrder(orderId, config.accessToken);
  return applyMercadoPagoCanonicalOrder(
    db,
    { ...attempt, order_id: orderId },
    order,
  );
}

export async function applyMercadoPagoCanonicalOrder(
  db: DB,
  attempt: any,
  order: any,
) {
  const config = getMercadoPagoConfig();
  const sessionResult = await db
    .from("mp_checkout_sessions")
    .select("*")
    .eq("id", attempt.session_id)
    .single();
  databaseError(sessionResult.error);
  const session = sessionResult.data;
  const status = evaluateMercadoPagoOrder(order, {
    orderId: attempt.order_id || order.id,
    externalReference: attempt.id,
    amountCents: session.amount_cents,
    collectorId: session.collector_id,
    applicationId: session.application_id,
  });
  if (
    session.environment !== config.environment ||
    session.collector_id !== config.collectorId ||
    session.application_id !== config.applicationId
  ) {
    throw new PaymentServiceError(
      "El ambiente del pago no coincide con la compra",
      409,
    );
  }
  const { data, error } = await db.rpc("mp_apply_order", {
    p_attempt: attempt.id,
    p_order: order.id,
    p_status: status,
    p_charge: order.transactions?.payments?.[0]?.id || null,
  });
  databaseError(error);
  const payment = order.transactions?.payments?.[0];
  // Orders uses the generic "failed" at order level. The single canonical
  // payment carries the actionable reason (e.g. Yape insufficient_amount).
  const providerDetail =
    status === "failed" &&
    order.transactions?.payments?.length === 1 &&
    payment?.status === "failed"
      ? payment.status_detail
      : order.status_detail;
  const challengeUrl =
    status === "pending" &&
    order.status === "action_required" &&
    order.status_detail === "pending_challenge" &&
    order.transactions?.payments?.length === 1 &&
    payment?.status === "action_required"
      ? safeMercadoPagoChallengeUrl(
          payment.payment_method?.transaction_security?.url,
        )
      : null;
  databaseError(
    (
      await db
        .from("mp_payment_attempts")
        .update({
          challenge_url: challengeUrl,
          provider_status_detail: /^[a-z0-9_]{1,100}$/.test(
            providerDetail || "",
          )
            ? providerDetail
            : null,
        })
        .eq("id", attempt.id)
        .eq("status", status)
    ).error,
  );
  if (data.status === "paid") await fulfillMercadoPagoCheckout(db, data.id);
  return data;
}

export async function submitMercadoPagoPayment(
  db: DB,
  session: any,
  body: any,
) {
  const config = getMercadoPagoConfig(true);
  assertCheckoutEnvironment(session);
  const reservationResult = await db
    .from("table_reservations")
    .select("email,table_id,sale_origin")
    .eq("id", session.reservation_id)
    .single();
  databaseError(reservationResult.error);
  if (
    body?.payment_method_id === "yape" &&
    !isYapeReservationAllowed(reservationResult.data)
  ) {
    throw new PaymentServiceError(
      "Yape no está disponible para este tipo de reserva.",
      400,
      "yape_reservation_unavailable",
    );
  }
  const card: MercadoPagoCardOrderInput = {
    deviceSessionId: body?.device_session_id,
    amountCents: session.amount_cents,
    externalReference: session.id,
    idempotencyKey: session.id,
    payer: {
      email:
        typeof body?.payer?.email === "string"
          ? body.payer.email.trim()
          : reservationResult.data.email,
      // The hosted fields already attach the cardholder document to the token.
      // Orders requires payer.email; avoid duplicating cardholder identity here.
    },
    paymentMethod: {
      id: body?.payment_method_id,
      type: body?.payment_type_id,
      token: body?.token,
      installments: Number(body?.installments),
    },
  };
  const yape: MercadoPagoYapeOrderInput | null =
    body?.payment_method_id === "yape"
      ? {
          deviceSessionId: body?.device_session_id,
          amountCents: session.amount_cents,
          externalReference: session.id,
          idempotencyKey: session.id,
          environment: config.environment,
          payer: {
            email: reservationResult.data.email,
            phoneNumber: body?.phone_number,
          },
          token: body?.token,
        }
      : null;
  // Validate before persisting an attempt; all prices still come from the session.
  const payload = yape
    ? buildMercadoPagoYapeOrder(yape)
    : buildMercadoPagoCardOrder(card);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  const claimed = await db.rpc("mp_claim_attempt", {
    p_session: session.id,
    p_request_hash: fingerprint,
  });
  if (claimed.error) throw checkoutDatabaseError(claimed.error);
  if (claimed.data.action === "reconcile")
    await reconcileMercadoPagoAttempt(db, claimed.data.attempt);
  if (claimed.data.action !== "submit") return;
  const attempt = claimed.data.attempt;
  try {
    const order = yape
      ? await createMercadoPagoYapeOrder(
          {
            ...yape,
            idempotencyKey: attempt.id,
            externalReference: attempt.id,
          },
          config.accessToken,
        )
      : await createMercadoPagoCardOrder(
          {
            ...card,
            idempotencyKey: attempt.id,
            externalReference: attempt.id,
          },
          config.accessToken,
        );
    // Bind the resource immediately; canonical re-reading then verifies the outcome.
    const linked = await db
      .from("mp_payment_attempts")
      .update({ order_id: order.id })
      .eq("id", attempt.id);
    databaseError(linked.error);
    await reconcileMercadoPagoAttempt(db, { ...attempt, order_id: order.id });
  } catch (error: any) {
    const definitive = error?.code === "mercadopago_request_rejected";
    await db
      .from("mp_payment_attempts")
      .update({
        status: definitive ? "failed" : "unknown",
        updated_at: new Date().toISOString(),
      })
      .eq("id", attempt.id)
      .eq("status", "creating");
    if (definitive) {
      await db
        .from("mp_checkout_sessions")
        .update({ status: "awaiting_payment" })
        .eq("id", session.id)
        .eq("status", "processing");
    } else {
      // Includes HTTP 402: an order may exist despite the non-2xx response.
      // Recover by the persisted reference; never generate a replacement key.
      try {
        await reconcileMercadoPagoAttempt(db, attempt);
        return;
      } catch {}
    }
    throw error;
  }
}

export async function fulfillMercadoPagoCheckout(db: DB, sessionId: string) {
  const claim = await db.rpc("mp_claim_fulfillment", { p_session: sessionId });
  databaseError(claim.error);
  if (!claim.data) return;
  try {
    const sessionResult = await db
      .from("mp_checkout_sessions")
      .select("reservation_id")
      .eq("id", sessionId)
      .single();
    databaseError(sessionResult.error);
    const res = await db
      .from("table_reservations")
      .select("*,table:tables(name),event:events(event_prefix)")
      .eq("id", sessionResult.data.reservation_id)
      .single();
    databaseError(res.error);
    const reservation = res.data;
    const quantity = Number(
      reservation.table_id
        ? reservation.ticket_quantity
        : reservation.total_ticket_units || reservation.ticket_quantity || 1,
    );
    const rows = await db
      .from("ticket_reservation_units")
      .select("unit_index")
      .eq("reservation_id", reservation.id);
    databaseError(rows.error);
    const indexes = new Set((rows.data || []).map((u: any) => u.unit_index));
    const missing = buildReservationUnits({
      reservationId: reservation.id,
      eventId: reservation.event_id,
      packageQuantity: 1,
      unitsPerPackage: quantity,
    }).filter((u) => !indexes.has(u.unit_index));
    if (missing.length)
      databaseError(
        (await db.from("ticket_reservation_units").insert(missing)).error,
      );
    // Repair a crash between ticket insert and unit binding. No replacement QR.
    const existing = await db
      .from("tickets")
      .select("id,document,doc_type,code_id")
      .eq("mp_checkout_session_id", sessionId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .eq("document", reservation.document)
      .eq("doc_type", reservation.doc_type)
      .limit(1)
      .maybeSingle();
    databaseError(existing.error);
    if (existing.data) {
      databaseError(
        (
          await db
            .from("codes")
            .update({ person_index: 1 })
            .eq("id", existing.data.code_id)
            .eq("table_reservation_id", reservation.id)
            .is("person_index", null)
        ).error,
      );
      const repaired = await db
        .from("ticket_reservation_units")
        .update({
          ticket_id: existing.data.id,
          status: "issued",
          issued_at: new Date().toISOString(),
        })
        .eq("reservation_id", reservation.id)
        .eq("unit_index", 1)
        .is("ticket_id", null);
      databaseError(repaired.error);
    }
    const prepared = await ensureReservationUnitCodes(db, {
      reservation: {
        ...reservation,
        table: {
          name: `${reservation.table?.name || "Mesa"}R${reservation.id.replaceAll("-", "").slice(-8)}`,
        },
      },
      units: Array.from({ length: quantity }, (_, index) => ({
        unit_index: index + 1,
      })),
    });
    if (prepared.orderedCodes.length !== quantity)
      throw new Error("reservation_codes_incomplete");
    const result = await ensureTicketOnlyBuyerIssued({
      supabase: db,
      reservation,
      reservationId: reservation.id,
      eventId: reservation.event_id,
      ticketQuantity: quantity,
      codeType: reservation.table_id ? "table" : "courtesy",
      tableId: reservation.table_id || null,
      productId: reservation.product_id || null,
      reusableCodes: prepared.orderedCodes,
    });
    if (
      !result.units.some((u: any) => Number(u.unit_index) === 1 && u.ticket_id)
    )
      throw new Error("buyer_ticket_missing");
    const completed = await db
      .from("mp_checkout_sessions")
      .update({
        status: "fulfilled",
        fulfilled_at: new Date().toISOString(),
        fulfillment_locked_until: null,
      })
      .eq("id", sessionId)
      .eq("status", "paid");
    databaseError(completed.error);
  } catch {
    await db
      .from("mp_checkout_sessions")
      .update({ fulfillment_locked_until: null })
      .eq("id", sessionId);
    // Accreditation is durable. The worker retries fulfillment, never the charge.
    return;
  }
}

export async function notifyMercadoPagoCheckout(db: DB, sessionId: string) {
  const claim = await db.rpc("mp_claim_notification", { p_session: sessionId });
  databaseError(claim.error);
  if (!claim.data) return;
  try {
    const s = await db
      .from("mp_checkout_sessions")
      .select("reservation_id")
      .eq("id", sessionId)
      .single();
    databaseError(s.error);
    const r = await db
      .from("table_reservations")
      .select("*,event:events(name,starts_at,location),table:tables(name)")
      .eq("id", s.data.reservation_id)
      .single();
    databaseError(r.error);
    const units = await db
      .from("ticket_reservation_units")
      .select("ticket_id")
      .eq("reservation_id", r.data.id)
      .eq("status", "issued");
    databaseError(units.error);
    const sent = await sendApprovalEmail({
      supabase: db,
      id: r.data.id,
      full_name: r.data.full_name,
      email: r.data.email,
      phone: r.data.phone,
      codes: r.data.codes || [],
      ticketIds: (units.data || [])
        .map((u: any) => u.ticket_id)
        .filter(Boolean),
      tableName: r.data.table?.name || r.data.ticket_type_label || "Entrada",
      event: r.data.event,
      resourceLabel: r.data.table_id ? "Mesa / box" : "Entradas",
      idempotencyKey: `mp-confirmation-${sessionId}`,
      callToAction: {
        label: "Mis entradas",
        url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3004"}/compra?reservationId=${r.data.id}`,
      },
    });
    await db
      .from("mp_notification_jobs")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        locked_until: null,
        provider_message_id: sent?.providerId || null,
      })
      .eq("session_id", sessionId);
  } catch {
    await db
      .from("mp_notification_jobs")
      .update({
        status: "error",
        locked_until: new Date(Date.now() + 30_000).toISOString(),
      })
      .eq("session_id", sessionId);
  }
}

export async function readMercadoPagoCheckout(
  db: DB,
  session: any,
  refresh = true,
) {
  if (
    session.status === "awaiting_payment" &&
    Date.parse(session.expires_at) <= Date.now()
  ) {
    databaseError((await db.rpc("mp_expire_checkouts")).error);
  }
  if (refresh && session.current_attempt_id) {
    const a = await db
      .from("mp_payment_attempts")
      .select("*")
      .eq("id", session.current_attempt_id)
      .maybeSingle();
    databaseError(a.error);
    if (
      a.data &&
      ["creating", "unknown", "pending"].includes(a.data.status) &&
      (!a.data.last_checked_at ||
        Date.now() - Date.parse(a.data.last_checked_at) > 8_000)
    ) {
      await reconcileMercadoPagoAttempt(db, a.data);
    }
  }
  await fulfillMercadoPagoCheckout(db, session.id);
  const s = await db
    .from("mp_checkout_sessions")
    .select("*")
    .eq("id", session.id)
    .single();
  databaseError(s.error);
  const r = await db
    .from("table_reservations")
    .select(
      "id,email,table_id,sale_origin,ticket_type_label,ticket_quantity,total_ticket_units,event:events(name,starts_at),table:tables(name)",
    )
    .eq("id", session.reservation_id)
    .single();
  databaseError(r.error);
  const units =
    s.data.status === "fulfilled"
      ? await db
          .from("ticket_reservation_units")
          .select("ticket_id,unit_index,status")
          .eq("reservation_id", session.reservation_id)
      : { data: [] };
  databaseError(units.error);
  const attempt = s.data.current_attempt_id
    ? await db
        .from("mp_payment_attempts")
        .select("status,challenge_url,provider_status_detail,created_at")
        .eq("id", s.data.current_attempt_id)
        .maybeSingle()
    : { data: null };
  databaseError(attempt.error);
  return {
    id: session.id,
    status: s.data.status,
    amountCents: session.amount_cents,
    currencyCode: "PEN",
    environment: session.environment,
    publicKey: getMercadoPagoConfig().publicKey,
    expiresAt: session.expires_at,
    email: r.data.email,
    paymentMethods: isYapeReservationAllowed(r.data)
      ? ["card", "yape"]
      : ["card"],
    event: r.data.event,
    attemptStatus: attempt.data?.status || null,
    paymentDetail: attempt.data?.provider_status_detail || null,
    challenge:
      s.data.status === "processing" &&
      attempt.data?.status === "pending" &&
      attempt.data.provider_status_detail === "pending_challenge" &&
      safeMercadoPagoChallengeUrl(attempt.data.challenge_url)
        ? {
            url: safeMercadoPagoChallengeUrl(attempt.data.challenge_url),
            expiresAt: new Date(
              Date.parse(attempt.data.created_at) + 40 * 60_000,
            ).toISOString(),
          }
        : null,
    concept: r.data.table?.name
      ? `Mesa / box ${r.data.table.name}`
      : r.data.ticket_type_label || "Entradas",
    quantity: Number(
      r.data.table_id
        ? r.data.ticket_quantity
        : r.data.total_ticket_units || r.data.ticket_quantity || 1,
    ),
    buyerTicketId:
      (units.data || []).find((u: any) => u.unit_index === 1)?.ticket_id ||
      null,
    nominationUrl:
      s.data.status === "fulfilled"
        ? `/compra?reservationId=${r.data.id}`
        : null,
  };
}

export async function processMercadoPagoWebhook(
  db: DB,
  input: { body: any; headers: Headers; search: URLSearchParams },
) {
  const config = getMercadoPagoConfig();
  const id = input.search.get("data.id") || "";
  if (input.body?.type !== "order") return { success: true, ignored: true };
  // The developer simulator sends live_mode=true even to the test URL. The
  // signed envelope is only a pointer. Canonical collector + application
  // checks above determine the environment and amount, never this body.
  if (!config.webhookSecret || !id || input.body?.data?.id !== id) {
    throw new PaymentServiceError(
      "Notificación de pago inválida",
      401,
      "webhook_envelope_invalid",
    );
  }
  try {
    const { WebhookSignatureValidator } = await import("mercadopago");
    WebhookSignatureValidator.validate({
      xSignature: input.headers.get("x-signature"),
      xRequestId: input.headers.get("x-request-id"),
      // Automatic Orders notifications sign the lowercase ID. Keep the exact
      // original ID for the envelope check and subsequent canonical API lookup.
      // mercadopago@3.6.1 trims this input but does not lowercase it itself.
      dataId: id.toLowerCase(),
      secret: config.webhookSecret,
    });
  } catch {
    throw new PaymentServiceError(
      "Firma de notificación inválida",
      401,
      "webhook_signature_invalid",
    );
  }
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        id,
        input.body.action,
        input.body.date_created,
        input.body.data.version,
      ]),
    )
    .digest("hex");
  const inserted = await db
    .from("mp_webhook_events")
    .upsert(
      { event_key: key, order_id: id },
      { onConflict: "event_key", ignoreDuplicates: true },
    );
  databaseError(inserted.error);
  const event = await db
    .from("mp_webhook_events")
    .select("status")
    .eq("event_key", key)
    .single();
  databaseError(event.error);
  if (event.data.status === "processed")
    return { success: true, duplicated: true };
  return reconcileMercadoPagoWebhookEvent(db, { event_key: key, order_id: id });
}

export async function reconcileMercadoPagoWebhookEvent(
  db: DB,
  event: { event_key: string; order_id: string },
) {
  const config = getMercadoPagoConfig();
  try {
    const order = await getMercadoPagoOrder(event.order_id, config.accessToken);
    const a = uuid.test(order.external_reference || "")
      ? await db
          .from("mp_payment_attempts")
          .select("*")
          .eq("id", order.external_reference)
          .maybeSingle()
      : { data: null };
    databaseError(a.error);
    if (a.data) await applyMercadoPagoCanonicalOrder(db, a.data, order);
    const done = await db
      .from("mp_webhook_events")
      .update({
        status: a.data ? "processed" : "ignored",
        processed_at: new Date().toISOString(),
      })
      .eq("event_key", event.event_key);
    databaseError(done.error);
    return { success: true, ignored: !a.data };
  } catch (error) {
    await db
      .from("mp_webhook_events")
      .update({ status: "error" })
      .eq("event_key", event.event_key);
    throw error;
  }
}
