import { normalizeCulqiStatus } from "./culqi";
import type { PaymentSupabaseClient } from "./supabase";
import { PaymentServiceError } from "./errors";
import {
  hasEnabledPaymentGateway,
  requireEnabledPaymentGateway,
} from "./registry";
import { buildReceiptNumber, splitCustomerName } from "./utils";

type CreatePaymentOrderInput = {
  supabase: PaymentSupabaseClient;
  providerName: string;
  body: any;
  idempotencyKey?: string;
};

type ProcessPaymentWebhookInput = {
  supabase: PaymentSupabaseClient;
  providerName: string;
  rawBody: string;
  headers: {
    get(name: string): string | null;
  };
};

type CreatePaymentChargeInput = {
  supabase: PaymentSupabaseClient;
  providerName: string;
  body: any;
};

type RefundPaymentInput = {
  supabase: PaymentSupabaseClient;
  providerName: string;
  paymentId: string;
  amount: number | null;
  reason: string;
};

type PaymentReceiptInput = {
  supabase: PaymentSupabaseClient;
  paymentId?: string;
  orderId?: string;
  providerName?: string;
};

function readMetadataString(metadata: Record<string, unknown>, key: string) {
  return typeof metadata[key] === "string" ? (metadata[key] as string) : null;
}

function readPositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function ensurePaymentReceipt(
  supabase: PaymentSupabaseClient,
  paymentId: string | null,
  seed: string | null,
) {
  if (!paymentId) return;
  const receiptNumber = buildReceiptNumber(seed || paymentId);
  await supabase
    .from("payments")
    .update({
      receipt_number: receiptNumber,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .is("receipt_number", null);
}

async function syncBusinessPaymentStatus(input: {
  supabase: PaymentSupabaseClient;
  reservationId: string | null;
  ticketId: string | null;
  status:
    | "pending"
    | "paid"
    | "failed"
    | "refunded"
    | "expired"
    | "canceled";
}) {
  const { supabase, reservationId, ticketId, status } = input;
  const now = new Date().toISOString();

  if (status === "paid" && reservationId) {
    const updateReservation = await supabase
      .from("table_reservations")
      .update({
        status: "approved",
        updated_at: now,
      })
      .eq("id", reservationId);

    if (updateReservation.error) {
      throw new Error(updateReservation.error.message);
    }
  }

  if (status === "paid" && ticketId) {
    const updateTicket = await supabase
      .from("tickets")
      .update({
        payment_status: "paid",
        is_active: true,
        updated_at: now,
      })
      .eq("id", ticketId);

    if (updateTicket.error) {
      throw new Error(updateTicket.error.message);
    }
  }

  if (
    (status === "failed" || status === "expired" || status === "canceled") &&
    ticketId
  ) {
    await supabase
      .from("tickets")
      .update({
        payment_status: "failed",
        updated_at: now,
      })
      .eq("id", ticketId);
  }
}

async function patchPaymentStatus(input: {
  supabase: PaymentSupabaseClient;
  paymentId: string;
  orderId: string | null;
  reservationId: string | null;
  ticketId: string | null;
  status:
    | "pending"
    | "paid"
    | "failed"
    | "refunded"
    | "expired"
    | "canceled";
  patch: Record<string, unknown>;
  existingReceiptNumber?: string | null;
}) {
  const { supabase, paymentId, orderId, reservationId, ticketId, status, patch } =
    input;
  const now = new Date().toISOString();
  const paymentPatch: Record<string, unknown> = {
    ...patch,
    status,
    updated_at: now,
  };

  if (status === "paid" && !paymentPatch.paid_at) {
    paymentPatch.paid_at = now;
  }
  if (status === "refunded" && !paymentPatch.refunded_at) {
    paymentPatch.refunded_at = now;
  }

  const updateRes = await supabase
    .from("payments")
    .update(paymentPatch)
    .eq("id", paymentId);

  if (updateRes.error) {
    throw new Error(updateRes.error.message);
  }

  await syncBusinessPaymentStatus({
    supabase,
    reservationId,
    ticketId,
    status,
  });

  if (status === "paid" && !input.existingReceiptNumber) {
    await ensurePaymentReceipt(supabase, paymentId, orderId || paymentId);
  }
}

async function resolvePaymentSubject(
  supabase: PaymentSupabaseClient,
  reservationId: string,
  ticketId: string,
) {
  let customerFullName = "";
  let customerEmail = "";
  let customerPhone = "";
  let eventId: string | null = null;
  let defaultDescription = "Entrada al evento BabyClub";
  let orderRefSuffix = "";
  const paymentInsertExtra: Record<string, string | null> = {};
  let amountFromReservation: number | null = null;

  if (reservationId) {
    const { data: reservation, error: reservationError } = await supabase
      .from("table_reservations")
      .select(
        "id,event_id,full_name,email,phone,status,sale_origin,ticket_total_amount,ticket_type_label",
      )
      .eq("id", reservationId)
      .limit(1)
      .maybeSingle();

    if (reservationError) {
      throw new PaymentServiceError(reservationError.message, 500);
    }
    if (!reservation) {
      throw new PaymentServiceError("Reserva no encontrada", 404);
    }
    if (reservation.status === "rejected") {
      throw new PaymentServiceError(
        "La reserva fue rechazada y no puede pagarse",
        400,
      );
    }

    customerFullName = reservation.full_name || "";
    customerEmail = reservation.email || "";
    customerPhone = reservation.phone || "";
    eventId = reservation.event_id || null;
    defaultDescription =
      reservation.sale_origin === "ticket"
        ? reservation.ticket_type_label || "Entrada al evento BabyClub"
        : "Reserva de evento BabyClub";
    orderRefSuffix = reservationId.slice(0, 6).toUpperCase();
    paymentInsertExtra.reservation_id = reservation.id;
    if (reservation.sale_origin === "ticket") {
      const totalAmount = Number(reservation.ticket_total_amount);
      amountFromReservation =
        Number.isFinite(totalAmount) && totalAmount > 0
          ? Math.round(totalAmount * 100)
          : null;
    }
  } else {
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("id,event_id,full_name,email,phone,is_active,payment_status")
      .eq("id", ticketId)
      .limit(1)
      .maybeSingle();

    if (ticketError) {
      throw new PaymentServiceError(ticketError.message, 500);
    }
    if (!ticket) {
      throw new PaymentServiceError("Ticket no encontrado", 404);
    }
    if (ticket.payment_status === "paid") {
      throw new PaymentServiceError("Este ticket ya fue pagado", 400);
    }

    customerFullName = ticket.full_name || "";
    customerEmail = ticket.email || "";
    customerPhone = ticket.phone || "";
    eventId = ticket.event_id || null;
    orderRefSuffix = ticketId.slice(0, 6).toUpperCase();
    paymentInsertExtra.ticket_id = ticket.id;
  }

  return {
    customerFullName,
    customerEmail,
    customerPhone,
    eventId,
    defaultDescription,
    orderRefSuffix,
    paymentInsertExtra,
    amountFromReservation,
  };
}

export async function createPaymentOrder({
  supabase,
  providerName,
  body,
  idempotencyKey,
}: CreatePaymentOrderInput) {
  const gateway = requireEnabledPaymentGateway(providerName);
  const reservationId =
    typeof body?.reservation_id === "string" ? body.reservation_id.trim() : "";
  const ticketId =
    typeof body?.ticket_id === "string" ? body.ticket_id.trim() : "";
  const amount = Number(body?.amount);
  const currencyCode = body?.currency_code === "PEN" ? "PEN" : "PEN";
  const expirationMinutesRaw = Number(body?.expiration_minutes ?? 20);
  const expirationMinutes = Number.isFinite(expirationMinutesRaw)
    ? Math.min(Math.max(expirationMinutesRaw, 5), 60)
    : 20;
  const orderNumberInput =
    typeof body?.order_number === "string" ? body.order_number.trim() : "";
  const idempotencyKeyBody =
    typeof body?.idempotency_key === "string"
      ? body.idempotency_key.trim()
      : "";
  const effectiveIdempotencyKey = idempotencyKey || idempotencyKeyBody;

  if (!reservationId && !ticketId) {
    throw new PaymentServiceError(
      "reservation_id o ticket_id es requerido",
      400,
    );
  }
  if (!effectiveIdempotencyKey) {
    throw new PaymentServiceError("idempotency_key es requerido", 400);
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new PaymentServiceError(
      "amount debe venir en centimos y ser entero > 0",
      400,
    );
  }

  const { data: existingPayment, error: existingPaymentError } = await supabase
    .from("payments")
    .select("id,order_id,status,amount,currency_code")
    .eq("provider", gateway.provider)
    .eq("idempotency_key", effectiveIdempotencyKey)
    .limit(1)
    .maybeSingle();

  if (existingPaymentError) {
    throw new PaymentServiceError(existingPaymentError.message, 500);
  }

  if (existingPayment?.order_id) {
    return {
      success: true,
      existing: true,
      provider: gateway.provider,
      orderId: existingPayment.order_id,
      paymentId: existingPayment.id,
      status: existingPayment.status,
      amount: existingPayment.amount,
      currencyCode: existingPayment.currency_code,
    };
  }

  const paymentContext = await resolvePaymentSubject(
    supabase,
    reservationId,
    ticketId,
  );
  const effectiveAmount = paymentContext.amountFromReservation || amount;
  const description =
    typeof body?.description === "string" && body.description.trim()
      ? body.description.trim()
      : paymentContext.defaultDescription;

  const names = splitCustomerName(paymentContext.customerFullName);
  const timestamp = Date.now();
  const orderNumber =
    orderNumberInput || `BC-${timestamp}-${paymentContext.orderRefSuffix}`;
  const expirationDateUnix = Math.floor(
    (timestamp + expirationMinutes * 60_000) / 1000,
  );

  let gatewayOrder: Awaited<ReturnType<typeof gateway.createOrder>>;
  try {
    gatewayOrder = await gateway.createOrder({
      amount: effectiveAmount,
      currencyCode,
      description,
      orderNumber,
      customer: {
        firstName: names.firstName,
        lastName: names.lastName,
        email: paymentContext.customerEmail || "no-email@babyclub.local",
        phoneNumber: paymentContext.customerPhone || "999999999",
      },
      expirationDateUnix,
      metadata: {
        ...paymentContext.paymentInsertExtra,
        event_id: paymentContext.eventId,
      },
    });
  } catch (error: any) {
    throw new PaymentServiceError(
      error?.message || `No se pudo crear orden en ${gateway.provider}`,
      error instanceof PaymentServiceError ? error.status : 502,
      error instanceof PaymentServiceError ? error.code : undefined,
    );
  }

  const { data: paymentInsert, error: paymentInsertError } = await supabase
    .from("payments")
    .insert({
      provider: gateway.provider,
      status: "pending",
      order_id: gatewayOrder.orderId,
      event_id: paymentContext.eventId,
      ...paymentContext.paymentInsertExtra,
      amount: effectiveAmount,
      currency_code: currencyCode,
      customer_email: paymentContext.customerEmail || null,
      customer_name: paymentContext.customerFullName || null,
      customer_phone: paymentContext.customerPhone || null,
      idempotency_key: effectiveIdempotencyKey,
      metadata: {
        ...paymentContext.paymentInsertExtra,
        event_id: paymentContext.eventId,
        order_number: orderNumber,
      },
      provider_payload: gatewayOrder.raw,
    })
    .select("id,status")
    .single();

  if (paymentInsertError) {
    throw new PaymentServiceError(paymentInsertError.message, 500);
  }

  return {
    success: true,
    provider: gateway.provider,
    orderId: gatewayOrder.orderId,
    paymentId: paymentInsert?.id || null,
    status: paymentInsert?.status || "pending",
    amount: effectiveAmount,
    currencyCode,
    expirationDateUnix,
  };
}

export async function createPaymentCharge({
  supabase,
  providerName,
  body,
}: CreatePaymentChargeInput) {
  const gateway = requireEnabledPaymentGateway(providerName);
  const paymentId =
    typeof body?.payment_id === "string" ? body.payment_id.trim() : "";
  const tokenId = typeof body?.token_id === "string" ? body.token_id.trim() : "";
  const emailBody = typeof body?.email === "string" ? body.email.trim() : "";
  const installments = readPositiveInteger(body?.installments);

  if (!paymentId) {
    throw new PaymentServiceError("payment_id es requerido", 400);
  }
  if (!tokenId) {
    throw new PaymentServiceError("token_id es requerido", 400);
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select(
      "id,provider,status,amount,currency_code,customer_email,customer_name,customer_phone,reservation_id,ticket_id,order_id,charge_id,receipt_number,event_id,metadata",
    )
    .eq("id", paymentId)
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    throw new PaymentServiceError(paymentError.message, 500);
  }
  if (!payment) {
    throw new PaymentServiceError("Pago no encontrado", 404);
  }
  if (payment.provider !== gateway.provider) {
    throw new PaymentServiceError(
      `El pago pertenece a ${payment.provider} y no a ${gateway.provider}`,
      409,
      "payment_provider_mismatch",
    );
  }
  if (payment.status === "paid" && payment.charge_id) {
    return {
      success: true,
      existing: true,
      provider: gateway.provider,
      paymentId: payment.id,
      orderId: payment.order_id,
      chargeId: payment.charge_id,
      status: payment.status,
    };
  }
  if (payment.status === "refunded") {
    throw new PaymentServiceError(
      "El pago ya fue devuelto y no puede volver a cobrarse",
      409,
    );
  }

  const email = emailBody || payment.customer_email || "no-email@babyclub.local";
  const metadata =
    payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {};
  const orderNumber = readMetadataString(
    metadata as Record<string, unknown>,
    "order_number",
  );
  const description =
    orderNumber || payment.order_id
      ? `Pago BabyClub ${orderNumber || payment.order_id}`
      : "Pago BabyClub";
  const names = splitCustomerName(payment.customer_name || "");

  let chargeResult: Awaited<ReturnType<typeof gateway.createCharge>>;
  try {
    chargeResult = await gateway.createCharge({
      amount: payment.amount,
      currencyCode: payment.currency_code || "PEN",
      email,
      sourceId: tokenId,
      description,
      installments,
      metadata: {
        ...(metadata as Record<string, unknown>),
        payment_id: payment.id,
        reservation_id: payment.reservation_id,
        ticket_id: payment.ticket_id,
        order_id: payment.order_id,
        event_id: payment.event_id,
      },
      antifraudDetails: {
        firstName: names.firstName,
        lastName: names.lastName,
        countryCode: "PE",
        phoneNumber: payment.customer_phone || null,
      },
    });
  } catch (error: any) {
    throw new PaymentServiceError(
      error?.message || `No se pudo crear cargo en ${gateway.provider}`,
      error instanceof PaymentServiceError ? error.status : 502,
      error instanceof PaymentServiceError ? error.code : undefined,
    );
  }

  const status = normalizeCulqiStatus(
    (chargeResult.raw as any)?.state ||
      (chargeResult.raw as any)?.response_code ||
      "paid",
  );

  await patchPaymentStatus({
    supabase,
    paymentId: payment.id,
    orderId: payment.order_id || null,
    reservationId: payment.reservation_id || null,
    ticketId: payment.ticket_id || null,
    status,
    existingReceiptNumber: payment.receipt_number || null,
    patch: {
      charge_id: chargeResult.chargeId,
      customer_email: email,
      provider_payload: chargeResult.raw,
    },
  });

  return {
    success: true,
    provider: gateway.provider,
    paymentId: payment.id,
    orderId: payment.order_id,
    chargeId: chargeResult.chargeId,
    status,
  };
}

export async function processPaymentWebhook({
  supabase,
  providerName,
  rawBody,
  headers,
}: ProcessPaymentWebhookInput) {
  const gateway = requireEnabledPaymentGateway(providerName);
  const parsed = gateway.parseWebhook({ rawBody, headers });

  if (parsed.signatureValid === false) {
    throw new PaymentServiceError("invalid_signature", 401);
  }

  const eventInsert = await supabase
    .from("payment_webhook_events")
    .insert({
      provider: gateway.provider,
      event_name: parsed.eventName,
      event_key: parsed.eventKey,
      signature: parsed.signature,
      payload: parsed.raw,
      status: "received",
    })
    .select("id")
    .single();

  if (eventInsert.error) {
    if (eventInsert.error.code === "23505") {
      return {
        success: true,
        duplicated: true,
        provider: gateway.provider,
        eventKey: parsed.eventKey,
      };
    }

    throw new PaymentServiceError(eventInsert.error.message, 500);
  }

  const webhookEventId = eventInsert.data?.id;

  try {
    if (parsed.orderId) {
      const { data: payment } = await supabase
        .from("payments")
        .select("id,reservation_id,ticket_id,receipt_number")
        .eq("provider", gateway.provider)
        .eq("order_id", parsed.orderId)
        .limit(1)
        .maybeSingle();

      const existingPaymentId = payment?.id || null;
      let paymentId: string | null = existingPaymentId;

      if (!paymentId) {
        const orphanInsert = await supabase
          .from("payments")
          .insert({
            provider: gateway.provider,
            status: parsed.status,
            order_id: parsed.orderId,
            charge_id: parsed.chargeId || null,
            amount: parsed.amount ?? 0,
            currency_code: parsed.currencyCode || "PEN",
            customer_email: parsed.customerEmail,
            customer_name: parsed.customerName,
            customer_phone: parsed.customerPhone,
            metadata: parsed.metadata,
            provider_payload: parsed.raw,
            paid_at: parsed.status === "paid" ? new Date().toISOString() : null,
            refunded_at:
              parsed.status === "refunded" ? new Date().toISOString() : null,
          })
          .select("id,reservation_id,ticket_id,receipt_number")
          .single();

        if (orphanInsert.error) {
          throw new Error(orphanInsert.error.message);
        }

        paymentId = orphanInsert.data?.id || null;
      } else {
        await patchPaymentStatus({
          supabase,
          paymentId,
          orderId: parsed.orderId,
          reservationId: payment?.reservation_id || null,
          ticketId: payment?.ticket_id || null,
          status: parsed.status,
          existingReceiptNumber: payment?.receipt_number || null,
          patch: {
          charge_id: parsed.chargeId || null,
          amount: parsed.amount ?? 0,
          currency_code: parsed.currencyCode || "PEN",
          customer_email: parsed.customerEmail,
          customer_name: parsed.customerName,
          customer_phone: parsed.customerPhone,
          metadata: parsed.metadata,
          provider_payload: parsed.raw,
          },
        });
      }

      const reservationId =
        payment?.reservation_id ||
        readMetadataString(parsed.metadata, "reservation_id");
      const ticketId =
        payment?.ticket_id || readMetadataString(parsed.metadata, "ticket_id");
      if (!existingPaymentId && paymentId && (reservationId || ticketId)) {
        await syncBusinessPaymentStatus({
          supabase,
          reservationId: reservationId || null,
          ticketId: ticketId || null,
          status: parsed.status,
        });
      }

      if (parsed.status === "paid" && paymentId && !payment?.receipt_number) {
        await ensurePaymentReceipt(supabase, paymentId, parsed.orderId);
      }
    }

    await supabase
      .from("payment_webhook_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", webhookEventId);
  } catch (error: any) {
    await supabase
      .from("payment_webhook_events")
      .update({
        status: "error",
        processing_error: error?.message || "unknown_error",
        processed_at: new Date().toISOString(),
      })
      .eq("id", webhookEventId);

    throw new PaymentServiceError(
      error?.message || "Error procesando webhook",
      500,
    );
  }

  return {
    success: true,
    provider: gateway.provider,
    event: parsed.eventName,
    orderId: parsed.orderId || null,
    status: parsed.status,
  };
}

export async function refundPayment({
  supabase,
  providerName,
  paymentId,
  amount,
  reason,
}: RefundPaymentInput) {
  const gateway = requireEnabledPaymentGateway(providerName);

  if (!paymentId) {
    throw new PaymentServiceError("payment_id es requerido", 400);
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id,provider,charge_id,amount,status,reservation_id,order_id")
    .eq("id", paymentId)
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    throw new PaymentServiceError(paymentError.message, 500);
  }
  if (!payment) {
    throw new PaymentServiceError("Pago no encontrado", 404);
  }
  if (payment.provider !== gateway.provider) {
    throw new PaymentServiceError(
      `El pago pertenece a ${payment.provider} y no a ${gateway.provider}`,
      409,
      "payment_provider_mismatch",
    );
  }
  if (!payment.charge_id) {
    throw new PaymentServiceError(
      "Este pago no tiene charge_id. Gestiona devolución desde el panel del proveedor o espera conciliación.",
      400,
    );
  }

  const refundAmount = amount ?? payment.amount;
  if (!Number.isInteger(refundAmount) || refundAmount <= 0) {
    throw new PaymentServiceError(
      "amount debe estar en centimos y ser entero > 0",
      400,
    );
  }

  let refundResult: Awaited<ReturnType<typeof gateway.createRefund>>;
  try {
    refundResult = await gateway.createRefund({
      chargeId: payment.charge_id,
      amount: refundAmount,
      reason,
      metadata: {
        payment_id: payment.id,
        reservation_id: payment.reservation_id,
      },
    });
  } catch (error: any) {
    throw new PaymentServiceError(
      error?.message || `No se pudo crear devolución en ${gateway.provider}`,
      error instanceof PaymentServiceError ? error.status : 502,
      error instanceof PaymentServiceError ? error.code : undefined,
    );
  }

  const updatePayment = await supabase
    .from("payments")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      provider_payload: refundResult.raw,
    })
    .eq("id", payment.id);

  if (updatePayment.error) {
    throw new PaymentServiceError(updatePayment.error.message, 500);
  }

  if (payment.reservation_id) {
    await supabase
      .from("table_reservations")
      .update({
        status: "rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.reservation_id);
  }

  return {
    success: true,
    provider: gateway.provider,
    paymentId: payment.id,
    orderId: payment.order_id,
    status: "refunded",
    refund: refundResult.raw,
  };
}

export async function getPaymentReceipt({
  supabase,
  paymentId,
  orderId,
  providerName,
}: PaymentReceiptInput) {
  if (!hasEnabledPaymentGateway()) {
    throw new PaymentServiceError(
      "payments_module_disabled",
      503,
      "payments_module_disabled",
    );
  }
  if (!paymentId && !orderId) {
    throw new PaymentServiceError("payment_id o order_id es requerido", 400);
  }

  let query = supabase
    .from("payments")
    .select(
      "id,provider,status,amount,currency_code,customer_name,customer_email,customer_phone,receipt_number,paid_at,created_at,reservation_id,event_id",
    )
    .limit(1);

  if (providerName) {
    query = query.eq("provider", providerName);
  }

  if (paymentId) {
    query = query.eq("id", paymentId);
  } else {
    query = query.eq("order_id", orderId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new PaymentServiceError(error.message, 500);
  }
  if (!data) {
    throw new PaymentServiceError("Comprobante no encontrado", 404);
  }

  let reservation: any = null;
  if (data.reservation_id) {
    const { data: reservationData } = await supabase
      .from("table_reservations")
      .select("id,full_name,event_id")
      .eq("id", data.reservation_id)
      .limit(1)
      .maybeSingle();
    reservation = reservationData || null;
  }

  let event: any = null;
  const eventId = reservation?.event_id || data.event_id;
  if (eventId) {
    const { data: eventData } = await supabase
      .from("events")
      .select("id,name,starts_at,location")
      .eq("id", eventId)
      .limit(1)
      .maybeSingle();
    event = eventData || null;
  }

  return {
    success: true,
    receipt: {
      payment_id: data.id,
      provider: data.provider,
      status: data.status,
      amount: data.amount,
      currency_code: data.currency_code,
      receipt_number: data.receipt_number,
      issued_at: data.paid_at || data.created_at,
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      customer_phone: data.customer_phone,
      reservation,
      event,
    },
  };
}
