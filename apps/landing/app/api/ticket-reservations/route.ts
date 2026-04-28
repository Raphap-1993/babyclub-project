import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeDocument,
  validateDocument,
  type DocumentType,
} from "shared/document";
import { applyNotDeleted } from "shared/db/softDelete";
import {
  ensureEventSalesDefaults,
  evaluateEventSales,
  isMissingEventSalesColumnsError,
} from "shared/eventSales";
import {
  resolveTicketTypeSelection,
  type TicketSalePhase,
} from "shared/ticketTypes";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const resolveActiveTicketSalePhase = (): TicketSalePhase => {
  const raw = (
    process.env.TICKET_SALE_PHASE ||
    process.env.NEXT_PUBLIC_TICKET_SALE_PHASE ||
    "early_bird"
  )
    .trim()
    .toLowerCase();
  return raw === "all_night" ? "all_night" : "early_bird";
};

function isMissingTicketTypesRelationError(error: any) {
  if (!error) return false;
  const haystack =
    `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return (
    haystack.includes("event_ticket_types") || haystack.includes("ticket_types")
  );
}

function isMissingTicketTypeReservationColumnsError(error: any) {
  if (!error) return false;
  const haystack =
    `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return (
    haystack.includes("ticket_type_id") ||
    haystack.includes("ticket_type_code") ||
    haystack.includes("ticket_type_label") ||
    haystack.includes("ticket_unit_price") ||
    haystack.includes("ticket_total_amount")
  );
}

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: "Supabase config missing" },
      { status: 500 },
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const event_id =
    typeof body?.event_id === "string" ? body.event_id.trim() : "";
  const promoter_id =
    typeof body?.promoter_id === "string" && body.promoter_id.trim()
      ? body.promoter_id.trim()
      : null;
  const docTypeRaw =
    typeof body?.doc_type === "string"
      ? (body.doc_type as DocumentType)
      : "dni";
  const documentRaw = typeof body?.document === "string" ? body.document : "";
  const { docType, document } = normalizeDocument(docTypeRaw, documentRaw);
  const first_name = typeof body?.nombre === "string" ? body.nombre.trim() : "";
  const last_name_p =
    typeof body?.apellido_paterno === "string"
      ? body.apellido_paterno.trim()
      : "";
  const last_name_m =
    typeof body?.apellido_materno === "string"
      ? body.apellido_materno.trim()
      : "";
  const full_name = [first_name, last_name_p, last_name_m]
    .filter(Boolean)
    .join(" ")
    .trim();
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.telefono === "string" ? body.telefono.trim() : "";
  const voucher_url =
    typeof body?.voucher_url === "string" ? body.voucher_url.trim() : "";
  const paymentMethod =
    typeof body?.payment_method === "string" ? body.payment_method : "yape";
  const quantityRaw =
    typeof body?.ticket_quantity === "number"
      ? body.ticket_quantity
      : parseInt(body?.ticket_quantity, 10);
  const ticket_quantity = Number.isFinite(quantityRaw)
    ? Math.floor(quantityRaw)
    : NaN;
  const ticketTypeCode =
    typeof body?.ticket_type_code === "string"
      ? body.ticket_type_code.trim()
      : "";
  const pricingPhaseRaw =
    typeof body?.pricing_phase === "string"
      ? body.pricing_phase.trim().toLowerCase()
      : "";
  const activeTicketSalePhase = resolveActiveTicketSalePhase();
  const requestedTicketSalePhase: TicketSalePhase =
    pricingPhaseRaw === "all_night"
      ? "all_night"
      : pricingPhaseRaw === "early_bird"
        ? "early_bird"
        : activeTicketSalePhase;

  if (!event_id) {
    return NextResponse.json(
      { success: false, error: "event_id es requerido" },
      { status: 400 },
    );
  }
  if (!ticketTypeCode && ticket_quantity !== 1 && ticket_quantity !== 2) {
    return NextResponse.json(
      { success: false, error: "ticket_quantity debe ser 1 o 2" },
      { status: 400 },
    );
  }
  if (
    pricingPhaseRaw &&
    pricingPhaseRaw !== "early_bird" &&
    pricingPhaseRaw !== "all_night"
  ) {
    return NextResponse.json(
      { success: false, error: "pricing_phase inválido" },
      { status: 400 },
    );
  }
  if (paymentMethod !== "culqi" && !voucher_url) {
    return NextResponse.json(
      { success: false, error: "voucher_url es requerido" },
      { status: 400 },
    );
  }
  if (!validateDocument(docType, document)) {
    return NextResponse.json(
      { success: false, error: "Documento inválido" },
      { status: 400 },
    );
  }
  if (!first_name || !last_name_p || !last_name_m) {
    return NextResponse.json(
      { success: false, error: "Nombre y apellidos requeridos" },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const eventQuery = applyNotDeleted(
    supabase
      .from("events")
      .select(
        "id,is_active,closed_at,sale_status,sale_public_message,early_bird_enabled,early_bird_price_1,early_bird_price_2,all_night_price_1,all_night_price_2,ticket_types:event_ticket_types(id,code,label,description,sale_phase,ticket_quantity,price,currency_code,is_active,sort_order)",
      )
      .eq("id", event_id),
  );
  let { data: eventRow, error: eventError } = await eventQuery.maybeSingle();
  if (
    eventError &&
    (isMissingEventSalesColumnsError(eventError) ||
      isMissingTicketTypesRelationError(eventError))
  ) {
    const legacyQuery = applyNotDeleted(
      supabase
        .from("events")
        .select(
          "id,is_active,closed_at,early_bird_enabled,early_bird_price_1,early_bird_price_2,all_night_price_1,all_night_price_2",
        )
        .eq("id", event_id),
    );
    const legacyResult = await legacyQuery.maybeSingle();
    eventRow = legacyResult.data as any;
    eventError = legacyResult.error;
  }

  if (eventError || !eventRow) {
    return NextResponse.json(
      { success: false, error: "Evento no encontrado" },
      { status: 404 },
    );
  }
  const saleDecision = evaluateEventSales(
    ensureEventSalesDefaults(eventRow as any),
  );
  if (!saleDecision.available) {
    return NextResponse.json(
      {
        success: false,
        error:
          saleDecision.public_message ||
          "La venta online no está disponible para este evento",
        code: "sales_blocked",
        sale_status: saleDecision.sale_status,
        sale_block_reason: saleDecision.block_reason,
        sale_public_message: saleDecision.public_message,
      },
      { status: 409 },
    );
  }

  const selectedTicketType = resolveTicketTypeSelection(eventRow, {
    code: ticketTypeCode,
    salePhase: requestedTicketSalePhase,
    ticketQuantity: ticket_quantity,
  });

  if (!selectedTicketType) {
    return NextResponse.json(
      {
        success: false,
        error: "Tipo de entrada no disponible para este evento",
        code: "ticket_type_unavailable",
      },
      { status: 409 },
    );
  }

  const finalTicketQuantity = selectedTicketType.ticketQuantity;
  const unitPrice = selectedTicketType.price / finalTicketQuantity;
  const totalAmount = selectedTicketType.price;

  const insertPayload = {
    table_id: null,
    event_id: event_id,
    sale_origin: "ticket",
    ticket_pricing_phase: selectedTicketType.salePhase,
    ticket_type_id: selectedTicketType.id || null,
    ticket_type_code: selectedTicketType.code,
    ticket_type_label: selectedTicketType.label,
    ticket_unit_price: unitPrice,
    ticket_total_amount: totalAmount,
    full_name,
    doc_type: docType,
    document,
    email: email || null,
    phone: phone || null,
    voucher_url,
    status: "pending",
    ticket_quantity: finalTicketQuantity,
    promoter_id: promoter_id || null,
  };

  let { data: reservation, error: resError } = await supabase
    .from("table_reservations")
    .insert(insertPayload)
    .select("id")
    .single();

  if (resError && isMissingTicketTypeReservationColumnsError(resError)) {
    const legacyPayload = { ...insertPayload } as Record<string, any>;
    delete legacyPayload.ticket_type_id;
    delete legacyPayload.ticket_type_code;
    delete legacyPayload.ticket_type_label;
    delete legacyPayload.ticket_unit_price;
    delete legacyPayload.ticket_total_amount;
    const legacyInsert = await supabase
      .from("table_reservations")
      .insert(legacyPayload)
      .select("id")
      .single();
    reservation = legacyInsert.data;
    resError = legacyInsert.error;
  }

  if (resError) {
    return NextResponse.json(
      { success: false, error: resError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    reservationId: reservation?.id,
    ticket_type_code: selectedTicketType.code,
    ticket_type_label: selectedTicketType.label,
    pricing_phase: selectedTicketType.salePhase,
    ticket_quantity: finalTicketQuantity,
    amount: totalAmount,
    amount_cents: Math.round(totalAmount * 100),
    currency_code: selectedTicketType.currencyCode,
    ticket_type: selectedTicketType,
  });
}
