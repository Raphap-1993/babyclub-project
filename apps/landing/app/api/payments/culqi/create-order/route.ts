import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createCulqiOrder } from "shared/payments/culqi";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const paymentsEnabled = process.env.ENABLE_CULQI_PAYMENTS?.toLowerCase() === "true";
export const runtime = "nodejs";

function splitName(fullName: string) {
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  if (!cleaned) return { firstName: "Cliente", lastName: "BabyClub" };
  const chunks = cleaned.split(" ");
  if (chunks.length === 1) return { firstName: chunks[0], lastName: "BabyClub" };
  return {
    firstName: chunks.slice(0, -1).join(" "),
    lastName: chunks.slice(-1).join(" "),
  };
}

export async function POST(req: NextRequest) {
  if (!paymentsEnabled) {
    return NextResponse.json({ success: false, error: "payments_module_disabled" }, { status: 503 });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const reservationId = typeof body?.reservation_id === "string" ? body.reservation_id.trim() : "";
  const ticketId = typeof body?.ticket_id === "string" ? body.ticket_id.trim() : "";
  const amount = Number(body?.amount);
  const currencyCode = body?.currency_code === "PEN" ? "PEN" : "PEN";
  const expirationMinutesRaw = Number(body?.expiration_minutes ?? 20);
  const expirationMinutes = Number.isFinite(expirationMinutesRaw) ? Math.min(Math.max(expirationMinutesRaw, 5), 60) : 20;
  const orderNumberInput = typeof body?.order_number === "string" ? body.order_number.trim() : "";
  const idempotencyKeyHeader = req.headers.get("idempotency-key")?.trim() || "";
  const idempotencyKeyBody = typeof body?.idempotency_key === "string" ? body.idempotency_key.trim() : "";
  const idempotencyKey = idempotencyKeyHeader || idempotencyKeyBody;

  if (!reservationId && !ticketId) {
    return NextResponse.json({ success: false, error: "reservation_id o ticket_id es requerido" }, { status: 400 });
  }
  if (!idempotencyKey) {
    return NextResponse.json({ success: false, error: "idempotency_key es requerido" }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ success: false, error: "amount debe venir en centimos y ser entero > 0" }, { status: 400 });
  }

  // Idempotency check — return existing order if already created
  const { data: existingPayment, error: existingPaymentError } = await supabase
    .from("payments")
    .select("id,order_id,status,amount,currency_code")
    .eq("idempotency_key", idempotencyKey)
    .limit(1)
    .maybeSingle();

  if (existingPaymentError) {
    return NextResponse.json({ success: false, error: existingPaymentError.message }, { status: 500 });
  }

  if (existingPayment?.order_id) {
    return NextResponse.json({
      success: true,
      existing: true,
      orderId: existingPayment.order_id,
      paymentId: existingPayment.id,
      status: existingPayment.status,
      amount: existingPayment.amount,
      currencyCode: existingPayment.currency_code,
    });
  }

  // Resolve customer and context from reservation or ticket
  let customerFullName = "";
  let customerEmail = "";
  let customerPhone = "";
  let eventId: string | null = null;
  let defaultDescription = "Entrada al evento BabyClub";
  let orderRefSuffix = "";
  const paymentInsertExtra: Record<string, string | null> = {};

  if (reservationId) {
    const { data: reservation, error: reservationError } = await supabase
      .from("table_reservations")
      .select("id,event_id,full_name,email,phone,status")
      .eq("id", reservationId)
      .limit(1)
      .maybeSingle();

    if (reservationError) {
      return NextResponse.json({ success: false, error: reservationError.message }, { status: 500 });
    }
    if (!reservation) {
      return NextResponse.json({ success: false, error: "Reserva no encontrada" }, { status: 404 });
    }
    if (reservation.status === "rejected") {
      return NextResponse.json({ success: false, error: "La reserva fue rechazada y no puede pagarse" }, { status: 400 });
    }

    customerFullName = reservation.full_name || "";
    customerEmail = reservation.email || "";
    customerPhone = reservation.phone || "";
    eventId = reservation.event_id || null;
    defaultDescription = "Reserva de evento BabyClub";
    orderRefSuffix = reservationId.slice(0, 6).toUpperCase();
    paymentInsertExtra.reservation_id = reservation.id;
  } else {
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("id,event_id,full_name,email,phone,is_active,payment_status")
      .eq("id", ticketId)
      .limit(1)
      .maybeSingle();

    if (ticketError) {
      return NextResponse.json({ success: false, error: ticketError.message }, { status: 500 });
    }
    if (!ticket) {
      return NextResponse.json({ success: false, error: "Ticket no encontrado" }, { status: 404 });
    }
    if (ticket.payment_status === "paid") {
      return NextResponse.json({ success: false, error: "Este ticket ya fue pagado" }, { status: 400 });
    }

    customerFullName = ticket.full_name || "";
    customerEmail = ticket.email || "";
    customerPhone = ticket.phone || "";
    eventId = ticket.event_id || null;
    orderRefSuffix = ticketId.slice(0, 6).toUpperCase();
    paymentInsertExtra.ticket_id = ticket.id;
  }

  const description =
    typeof body?.description === "string" && body.description.trim()
      ? body.description.trim()
      : defaultDescription;

  const names = splitName(customerFullName);
  const timestamp = Date.now();
  const orderNumber = orderNumberInput || `BC-${timestamp}-${orderRefSuffix}`;
  const expirationDateUnix = Math.floor((timestamp + expirationMinutes * 60_000) / 1000);

  let culqiOrder: any = null;
  try {
    culqiOrder = await createCulqiOrder({
      amount,
      currencyCode,
      description,
      orderNumber,
      customer: {
        firstName: names.firstName,
        lastName: names.lastName,
        email: customerEmail || "no-email@babyclub.local",
        phoneNumber: customerPhone || "999999999",
      },
      expirationDateUnix,
      metadata: {
        ...paymentInsertExtra,
        event_id: eventId,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "No se pudo crear orden en Culqi" }, { status: 502 });
  }

  const orderId = typeof culqiOrder?.id === "string" ? culqiOrder.id : null;
  if (!orderId) {
    return NextResponse.json({ success: false, error: "Respuesta invalida de Culqi (sin order id)" }, { status: 502 });
  }

  const { data: paymentInsert, error: paymentInsertError } = await supabase
    .from("payments")
    .insert({
      provider: "culqi",
      status: "pending",
      order_id: orderId,
      event_id: eventId,
      ...paymentInsertExtra,
      amount,
      currency_code: currencyCode,
      customer_email: customerEmail || null,
      customer_name: customerFullName || null,
      customer_phone: customerPhone || null,
      idempotency_key: idempotencyKey,
      metadata: {
        ...paymentInsertExtra,
        event_id: eventId,
        order_number: orderNumber,
      },
      provider_payload: culqiOrder,
    })
    .select("id,status")
    .single();

  if (paymentInsertError) {
    return NextResponse.json({ success: false, error: paymentInsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    orderId,
    paymentId: paymentInsert?.id,
    status: paymentInsert?.status || "pending",
    amount,
    currencyCode,
    expirationDateUnix,
  });
}
